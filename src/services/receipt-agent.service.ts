import { prisma } from '@/lib/db';
import { ChatVertexAI } from "@langchain/google-vertexai-web";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getFileBuffer } from '@/lib/storage';
import { detectBillingAccount, getBillingAccountConfig } from '@/lib/afip';
import { retryWithBackoff } from '@/lib/retry-utils';
import { notifyReceiptUploaded, notifyVendorsReceiptError, type DuplicatePaymentRef } from '@/lib/receipt-notify';
import { formatDate } from '@/lib/format-date';

/**
 * Medios de pago con tarjeta / terminal (Payway, Naranja, Go Cuotas). El ticket
 * imprime el CUIT de la TERMINAL del comercio, que no coincide con el CUIT de
 * facturación AFIP (ISH/YANI) — por eso no se compara para no dar falsos positivos.
 */
const CARD_TERMINAL_METHODS = [
    'PAY_WAY_6_ISH', 'PAY_WAY_6_YANI', 'PAY_WAY_3_ISH', 'PAY_WAY_3_YANI',
    'NARANJA_Z_ISH', 'NARANJA_Z_YANI', 'GO_CUOTAS', 'GO_CUOTAS_ISH',
    'CREDIT', 'CREDIT_3', 'CREDIT_6', 'DEBIT', 'PLAN_Z',
];

/**
 * A partir de cuántos días de antigüedad (fecha del comprobante vs. hoy) se avisa
 * "comprobante viejo". 10 días da margen para transferencias que el vendedor sube
 * unos días después del pago, sin dejar de avisar por un comprobante claramente
 * de otra venta. (Decisión del usuario, 2026-07-20.)
 */
const STALE_RECEIPT_DAYS = 10;

/**
 * Parsea una fecha impresa en un comprobante a un Date, de forma determinística
 * (NO depende de cómo la IA interprete el formato). Soporta:
 *  - Argentino día/mes/año: "17/07/26", "17/07/2026", "17-07-26" → 17-jul-2026
 *    (nunca 2017: no confunde el día con el año; año de 2 dígitos → 2000+).
 *  - ISO año-primero: "2026-07-17" → 17-jul-2026 (por si un comprobante lo imprime así).
 * Ignora la hora que venga al lado. Devuelve null si no matchea o es inválida.
 */
export function parseArgentineReceiptDate(raw?: string | null): Date | null {
    if (!raw) return null;
    const s = String(raw);
    const build = (day: number, month: number, year: number): Date | null => {
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        const d = new Date(year, month - 1, day);
        return isNaN(d.getTime()) ? null : d;
    };
    // ISO (año primero, 4 dígitos): parsear directo sin invertir.
    const iso = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    if (iso) return build(parseInt(iso[3], 10), parseInt(iso[2], 10), parseInt(iso[1], 10));
    // Argentino día/mes/año.
    const m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (!m) return null;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return build(parseInt(m[1], 10), parseInt(m[2], 10), year);
}

import {
    collectReferenceIds,
    crossCheckReadings,
    looksLikeSeparatorArtifact,
    parseReceiptAmount,
    readerSystemPrompt,
    readerUserPrompt,
    referencesMatch,
    sameVoucherNumber,
    stripTxTags,
    strongIds,
    verifierSystemPrompt,
    type ReceiptReading
} from '@/lib/receipt-references';
import { cardVoucherKey } from '@/lib/payment-card';

export class ReceiptAgentService {
    private static visionModel() {
        return new ChatVertexAI({
            model: "gemini-2.5-flash",
            location: "global",
            maxOutputTokens: 2048,
            temperature: 0,
        });
    }

    /** Pide el JSON a Gemini y lo parsea; null si no se pudo interpretar. */
    private static async askVision(systemPrompt: string, userText: string, mimeType: string, base64Data: string, label: string): Promise<string | null> {
        try {
            const response = await retryWithBackoff(
                () => this.visionModel().invoke([
                    new SystemMessage(systemPrompt),
                    new HumanMessage({
                        content: [
                            { type: "text", text: userText },
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                        ]
                    })
                ]),
                { label }
            );
            return response.content.toString();
        } catch (err: any) {
            console.error(`[ReceiptAgent] ${label} falló:`, err?.message || err);
            return null;
        }
    }

    /**
     * Una lectura completa del comprobante. Se corre DOS veces con consignas
     * redactadas distinto ('principal' y 'supervisor') para que los dos lectores
     * no compartan el mismo sesgo: lo que uno malinterprete, el otro lo desmiente.
     */
    private static async readReceipt(mimeType: string, base64Data: string, role: 'principal' | 'supervisor'): Promise<ReceiptReading | null> {
        const text = await this.askVision(
            readerSystemPrompt(role),
            readerUserPrompt(role),
            mimeType,
            base64Data,
            `ReceiptAgent:${role}`
        );
        if (!text) return null;

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            const parsed = JSON.parse(jsonMatch[0]);
            const texto = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
            // El importe se saca del que está IMPRESO (amount_raw) y se parsea acá,
            // no como lo haya convertido la IA: "$318.500" es 318500, no 318,5.
            // Mismo blindaje que se le hace a la fecha con date_raw.
            const amountRaw = texto(parsed.amount_raw);
            const amount = parseReceiptAmount(amountRaw) ?? parseReceiptAmount(
                typeof parsed.amount === 'number' || typeof parsed.amount === 'string' ? parsed.amount : null
            );
            return {
                amount: amount != null && Number.isFinite(amount) ? amount : null,
                amountRaw,
                cuit: typeof parsed.cuit === 'string' && parsed.cuit.trim() ? parsed.cuit.trim() : null,
                date: typeof parsed.date === 'string' && parsed.date.trim() ? parsed.date.trim() : null,
                dateRaw: texto(parsed.date_raw),
                ids: collectReferenceIds(parsed),
                batchNumber: texto(parsed.batch_number),
                couponNumber: texto(parsed.coupon_number),
                authNumber: texto(parsed.auth_number)
            };
        } catch (e) {
            console.error(`[ReceiptAgent] No se pudo parsear el JSON del lector ${role}:`, e, text);
            return null;
        }
    }

    /**
     * Control final antes de mandar un mail firmado por Ishtar: mira otra vez el
     * comprobante y confirma o descarta cada observación por separado. Ante la
     * mínima duda descarta, así nunca sale un reclamo equivocado a su nombre.
     * Devuelve null si la verificación no pudo correr (entonces no se manda nada).
     */
    private static async verifyIssues(
        mimeType: string,
        base64Data: string,
        ctx: { clientName: string; loadedAmount: number; issues: string[] }
    ): Promise<{ confirmada: boolean; motivo: string }[] | null> {
        const listado = ctx.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n');

        const text = await this.askVision(
            verifierSystemPrompt(ctx),
            `Observaciones a verificar:\n${listado}`,
            mimeType,
            base64Data,
            'ReceiptAgent:verificador'
        );
        if (!text) return null;

        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;
            const parsed = JSON.parse(jsonMatch[0]);
            const raw = Array.isArray(parsed?.verificaciones) ? parsed.verificaciones : null;
            // Si el verificador no devolvió un veredicto por observación, no se
            // manda nada: preferimos un aviso al admin antes que un mail dudoso.
            if (!raw || raw.length !== ctx.issues.length) {
                console.error('[ReceiptAgent] El verificador devolvió una lista incompleta:', text);
                return null;
            }
            return raw.map((v: any) => ({
                confirmada: v?.confirmada === true,
                motivo: typeof v?.motivo === 'string' ? v.motivo : ''
            }));
        } catch (e) {
            console.error('[ReceiptAgent] No se pudo parsear el JSON del verificador:', e, text);
            return null;
        }
    }

    /**
     * Analiza asíncronamente un comprobante para buscar discrepancias (monto, CUIT, fecha, duplicación).
     */
    static async analyzeReceipt(
        paymentId: string,
        orderId: string,
        receiptUrl: string,
        expectedAmount: number,
        method: string,
        uploadedByName?: string | null
    ) {
        let adminEmailSent = false;
        try {
            console.log(`[ReceiptAgent] Beginning analysis for Payment ${paymentId}`);

            const orderInfo = await prisma.order.findUnique({
                where: { id: orderId },
                select: { client: { select: { id: true, name: true } } }
            });
            const clientName = orderInfo?.client?.name || 'Desconocido';
            const emailBase = {
                clientName,
                clientId: orderInfo?.client?.id,
                orderId,
                amount: expectedAmount,
                method,
                receiptUrl,
                uploadedByName: uploadedByName || null
            };

            // 1. Convert file from storage to base64
            const buffer = await getFileBuffer(receiptUrl);
            if (!buffer) {
                console.warn(`[ReceiptAgent] No se pudo leer el archivo ${receiptUrl}`);
                adminEmailSent = true;
                await notifyReceiptUploaded({ ...emailBase, auditErrors: null });
                return;
            }

            // Determine image mime type based on extension
            let mimeType = 'image/jpeg';
            if (receiptUrl.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            if (receiptUrl.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
            if (receiptUrl.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf'; // Gemini Vision also supports PDFs

            const base64Data = buffer.toString('base64');

            // 2. Determine Expected CUIT
            const account = detectBillingAccount([{ method }]);
            let expectedCuit: number | null = null;
            if (account) {
                expectedCuit = getBillingAccountConfig(account).cuit;
            }

            // 3. DOS lecturas independientes del mismo comprobante (Gemini Vertex).
            // El mail a los vendedores sale firmado por Ishtar: un dato mal leído
            // por OCR la deja mandando una acusación falsa. Por eso ningún dato se
            // usa para acusar si los dos lectores no leyeron lo mismo.
            const [primaryRead, supervisorRead] = await Promise.all([
                this.readReceipt(mimeType, base64Data, 'principal'),
                this.readReceipt(mimeType, base64Data, 'supervisor')
            ]);

            if (!primaryRead) throw new Error('Error al interpretar respuesta de IA');

            console.log(`[ReceiptAgent] Lecturas para payment ${paymentId}:`, { primaryRead, supervisorRead });

            // 4. Cruce de las dos lecturas: solo pasa lo que ambas vieron igual.
            const agreed = crossCheckReadings(primaryRead, supervisorRead);
            const extracted = agreed.values;

            // 5. Validation Rules
            //
            // Una observación REAL (`findings`) es la que se le puede reclamar a
            // alguien: va al mail firmado por Ishtar y pinta el aviso al admin de
            // rojo. Todo lo demás (`notes`) es contexto para el admin y nada más —
            // mezclarlos hacía que un pago perfecto llegara como "⚠️ con
            // observaciones" y que Ishtar tuviera que revisar a mano un mail que en
            // realidad no decía nada.
            const findings: { admin: string; vendor: string }[] = [];
            const notes: string[] = [];
            // Pagos anteriores con el mismo nº de operación → links a ambas fichas
            const duplicateRefs: DuplicatePaymentRef[] = [];

            // Lo que los dos lectores leyeron distinto no se audita: queda como
            // aviso para el admin, nunca como reclamo a un vendedor.
            notes.push(...agreed.disagreements);

            const pesos = (n: number) => `$${n.toLocaleString('es-AR')}`;

            // A) Check Amount
            const tolerance = 5; // 5 pesos de tolerancia por errores de redondeo o carga
            if (extracted.amount != null && Math.abs(extracted.amount - expectedAmount) > tolerance) {
                const enComprobante = extracted.amountRaw ? `$${extracted.amountRaw}` : pesos(extracted.amount);
                if (looksLikeSeparatorArtifact(extracted.amount, expectedAmount)) {
                    // Un punto de miles leído como coma decimal NO es una diferencia
                    // de plata. Se anota y no se le reclama a nadie.
                    notes.push(`El monto leído (${enComprobante}) y el cargado (${pesos(expectedAmount)}) difieren solo en dónde cae el separador de miles — se tomó como error de lectura, no se reclamó nada.`);
                } else if (expectedAmount < extracted.amount) {
                    // Un mismo comprobante puede cubrir DOS ventas: se carga una
                    // parte acá y el resto en la otra. Cargar de menos no es un error
                    // (decisión del usuario, 31/7/2026) — se anota para el admin.
                    notes.push(`El comprobante es por ${enComprobante} y en esta venta se cargaron ${pesos(expectedAmount)}: puede ser un pago repartido entre varias ventas. No se reclamó nada.`);
                } else {
                    // Cargar MÁS de lo que prueba el comprobante sí es un problema.
                    findings.push({
                        admin: `Monto difiere. Comprobante dice ${enComprobante}, se cargó ${pesos(expectedAmount)}.`,
                        vendor: `El comprobante está por ${enComprobante} pero el pago lo cargaron por ${pesos(expectedAmount)}.`
                    });
                }
            }

            // B) Check CUIT — se compara solo si hay un CUIT de facturación esperado
            // y NO es un ticket de tarjeta. Alcance real HOY: `expectedCuit` sale de
            // detectBillingAccount(), que solo resuelve cuenta (ISH/YANI) para métodos
            // de tarjeta, y esos se saltean acá porque el ticket imprime el CUIT de la
            // TERMINAL del comercio, no el de AFIP (era la fuente del falso positivo).
            // Las transferencias no están mapeadas a una cuenta → expectedCuit=null →
            // este chequeo hoy NO dispara para ningún medio; queda listo para cuando se
            // configure el CUIT de las cuentas de transferencia. Se coacciona a String
            // por si la IA devuelve el CUIT como número.
            const isCardTerminal = CARD_TERMINAL_METHODS.includes(method);
            if (!isCardTerminal && expectedCuit && extracted.cuit) {
                const extractedCuit = String(extracted.cuit);
                if (!extractedCuit.includes(expectedCuit.toString())) {
                    findings.push({
                        admin: `CUIT de destino distinto. Se esperaba ${expectedCuit} y figura ${extractedCuit}.`,
                        vendor: `La transferencia fue a otro CUIT: en el comprobante figura ${extractedCuit} y tendría que ser ${expectedCuit}.`
                    });
                }
            }

            // C) Check Transaction ID + Check Duplicates
            // Un comprobante trae VARIOS identificadores (Mercado Pago: "Número de
            // operación" Y "Código de identificación"). El vendedor puede tipear
            // cualquiera de ellos y estar en lo correcto, así que se compara contra
            // todos y se etiquetan todos para el chequeo de duplicados.
            const extractedIds = extracted.ids;

            // Fetch current payment to compare what the vendor loaded vs. the receipt
            const currentPayment = await prisma.payment.findUnique({
                where: { id: paymentId },
                select: { notes: true, cardMode: true, batchNumber: true, couponNumber: true, authNumber: true }
            });

            // C bis) Cupón de posnet: cada número cargado se compara con el que
            // leyeron los dos lectores. Los ceros a la izquierda no cuentan.
            const camposCupon: { campo: 'batchNumber' | 'couponNumber' | 'authNumber'; etiqueta: string }[] = [
                { campo: 'batchNumber', etiqueta: 'lote' },
                { campo: 'couponNumber', etiqueta: 'cupón' },
                { campo: 'authNumber', etiqueta: 'autorización' }
            ];
            for (const { campo, etiqueta } of camposCupon) {
                const cargado = currentPayment?.[campo];
                const enTicket = extracted[campo];
                if (!cargado || !enTicket) continue; // sin acuerdo de los dos lectores no se audita
                if (!sameVoucherNumber(cargado, enTicket)) {
                    findings.push({
                        admin: `Nº de ${etiqueta} distinto: se cargó "${cargado}" y en el ticket dice "${enTicket}".`,
                        vendor: `El nº de ${etiqueta} no me coincide: cargaron "${cargado}" y en el ticket veo "${enTicket}".`
                    });
                }
            }

            if (extractedIds.length > 0) {
                const extractedTx = extractedIds[0];

                // Para buscar duplicados solo sirven los identificadores largos: un
                // nº de lote o de cupón se repite todos los días. En los cobros
                // presenciales la clave es el trío lote+cupón+autorización.
                const voucherKey = cardVoucherKey(currentPayment);
                const dedupIds = [...strongIds(extractedIds), ...(voucherKey ? [voucherKey] : [])];
                const tags = dedupIds.map(id => `[TX: ${id}]`).join(' ');

                const userTypedNotes = (currentPayment?.notes || '').trim();

                // Strip any previous [TX: ...] tag from notes for clean comparison
                const userReference = stripTxTags(userTypedNotes);

                const referenceMatchesExtracted = extractedIds.some(id => referencesMatch(userReference, id));

                // Solo se reclama una referencia cuando los DOS lectores listaron
                // identificadores y en ninguno de los dos aparece la que se cargó.
                if (userReference && !referenceMatchesExtracted && agreed.bothListedIds) {
                    // Se avisa, pero NO se pisa lo que cargó la persona: si la IA leyó
                    // mal, la corrección automática destruiría el dato bueno.
                    const listado = extractedIds.map(id => `"${id}"`).join(' ni ');
                    findings.push({
                        admin: `Referencia distinta: se cargó "${userReference}" y en el comprobante figura ${listado}. Revisar a mano — NO se modificó el pago.`,
                        vendor: `Cargaron la referencia "${userReference}" y en el comprobante no la encuentro: ahí figura ${listado}. ¿Se fijan cuál corresponde y la corrigen?`
                    });
                }

                // La referencia tipeada se conserva siempre; los [TX: ...] se agregan
                // al final solo para el rastreo de duplicados.
                const nuevasNotas = [userReference, tags].filter(Boolean).join(' ').trim();
                await prisma.payment.update({
                    where: { id: paymentId },
                    data: { notes: nuevasNotas || null },
                    select: { id: true }
                });

                // Check for duplicate transactions across other payments
                const duplicates = dedupIds.length === 0 ? [] : await prisma.payment.findMany({
                    where: {
                        id: { not: paymentId },
                        OR: dedupIds.map(id => ({ notes: { contains: `[TX: ${id}]` } }))
                    },
                    select: {
                        id: true,
                        orderId: true,
                        order: { select: { client: { select: { id: true, name: true } } } }
                    }
                });

                if (duplicates.length > 0) {
                    duplicateRefs.push(...duplicates.map(d => ({
                        clientName: d.order?.client?.name || 'Cliente Desconocido',
                        clientId: d.order?.client?.id,
                        orderId: d.orderId
                    })));
                    const duplicateDetails = duplicates.map(d => {
                        const clientName = d.order?.client?.name || 'Cliente Desconocido';
                        return `ID: ...${d.id.slice(-4).toUpperCase()} de ${clientName}`;
                    }).join(', ');
                    findings.push({
                        admin: `¡Posible Duplicado! El comprobante tiene la Operación ${extractedTx}, igual a la/s en pago/s: ${duplicateDetails}.`,
                        vendor: `El número de operación ${extractedTx} ya estaba cargado en otro pago (${duplicateDetails}) — parece el mismo comprobante dos veces.`
                    });
                }
            }

            // D) Check Date — solo avisa si el comprobante es genuinamente VIEJO.
            // Se parsea la fecha impresa de forma DETERMINÍSTICA (parseArgentineReceiptDate,
            // acepta dd/MM/aa o ISO) para no depender de cómo la convierta la IA:
            // "17/07/26" es 17-jul-2026, no 2017. A propósito NO se cae a
            // `extracted.date` (la fecha que la IA ya convirtió): si la IA mal-sigla
            // el año ahí, reintroduciría el falso positivo de "comprobante viejo".
            // Si no se puede leer date_raw de forma confiable, NO se avisa: preferimos
            // perder una detección antes que mandarle un falso positivo a los vendedores.
            const receiptDate = parseArgentineReceiptDate(extracted.dateRaw);
            if (receiptDate && !isNaN(receiptDate.getTime())) {
                const now = new Date();
                // Solo el PASADO: una fecha futura es casi seguro un error de lectura,
                // no un comprobante "viejo" — no tiene sentido avisar por eso.
                const diffDays = Math.floor((now.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays > STALE_RECEIPT_DAYS) {
                    const fechaFmt = formatDate(receiptDate);
                    findings.push({
                        admin: `Fecha antigua. El comprobante indica la fecha ${fechaFmt}.`,
                        vendor: `El comprobante es del ${fechaFmt}, quedó viejo — fíjense que sea el que corresponde a esta venta.`
                    });
                }
            }

            // 6. Supervisor final: antes de tocar nada, vuelve a mirar el comprobante
            // y confirma o descarta UNA POR UNA las observaciones. Solo sale a los
            // vendedores lo que queda confirmado — el mail va firmado por Ishtar.
            // Lo que descarta baja a nota del admin y no ensucia el aviso: antes
            // salía en rojo, igual que un error real.
            let confirmed: { admin: string; vendor: string }[] = [];
            let verificationFailed = false;
            if (findings.length > 0) {
                const verdicts = await this.verifyIssues(mimeType, base64Data, {
                    clientName,
                    loadedAmount: expectedAmount,
                    issues: findings.map(f => f.vendor)
                });

                if (!verdicts) {
                    verificationFailed = true;
                    notes.push(`El segundo control no pudo verificar ${findings.length === 1 ? 'la observación' : 'las observaciones'} — NO se envió el mail a los vendedores, revisar a mano: ${findings.map(f => f.admin).join(' ')}`);
                } else {
                    confirmed = findings.filter((_, i) => verdicts[i]?.confirmada);
                    verdicts.forEach((v, i) => {
                        if (!v?.confirmada) {
                            notes.push(`Observación descartada por el supervisor (no se le mandó a nadie): "${findings[i].vendor}" — ${v?.motivo || 'no se pudo comprobar contra el comprobante'}.`);
                        }
                    });
                }
            }

            const errors = confirmed.map(f => f.admin);

            // 7. Report if errors
            // La notificación en el CRM es para lo accionable: una observación
            // confirmada, o una verificación que no pudo correr. Un desacuerdo entre
            // lectores o una observación descartada no abren un pendiente.
            if (errors.length > 0 || verificationFailed) {
                const detalle = errors.length > 0 ? errors.join(' ') : notes.join(' ');
                const alertMsg = `ERROR IA en Comprobante (${clientName}${uploadedByName ? `, cargado por ${uploadedByName}` : ''}): ${detalle}`;

                await prisma.notification.create({
                    data: {
                        type: 'RECEIPT_ERROR',
                        message: alertMsg,
                        orderId: orderId,
                        requestedBy: 'IA (Auditor)',
                        status: 'PENDING'
                    }
                });
            } else {
                 console.log(`[ReceiptAgent] Payment ${paymentId} check passed successfully.`);
            }

            // Mail a los vendedores como si lo mandara Ishtar pidiendo corregir la carga
            if (confirmed.length > 0) {
                await notifyVendorsReceiptError({
                    clientName,
                    clientId: orderInfo?.client?.id,
                    orderId,
                    amount: expectedAmount,
                    receiptUrl,
                    issues: confirmed.map(f => f.vendor),
                    // El duplicado se nombra solo si esa observación sobrevivió a la verificación.
                    duplicateRefs: confirmed.some(f => f.vendor.includes('ya estaba cargado en otro pago')) ? duplicateRefs : []
                });
            }

            // Email único al admin: comprobante adjunto + veredicto de la auditoría
            adminEmailSent = true;
            await notifyReceiptUploaded({
                ...emailBase,
                reference: extractedIds.join(' · ') || null,
                auditErrors: errors,
                auditNotes: notes,
                // Los links a las dos fichas solo tienen sentido si el duplicado
                // quedó confirmado; si no, es un cartel naranja por nada.
                duplicateRefs: errors.some(e => e.startsWith('¡Posible Duplicado!')) ? duplicateRefs : []
            });

        } catch (err: any) {
             const { handleAIError } = await import('@/lib/ai-error-handler');
             try {
                 await handleAIError(err, 'Agente Auditor de Comprobantes (OCR)');
             } catch (handledError: any) {
                 console.error(`[ReceiptAgent] Agent failed for ${paymentId}:`, handledError.message);
             }
             // Aunque la auditoría falle, el admin recibe el comprobante por email
             if (!adminEmailSent) {
                 try {
                     const orderInfo = await prisma.order.findUnique({
                         where: { id: orderId },
                         select: { client: { select: { id: true, name: true } } }
                     });
                     await notifyReceiptUploaded({
                         clientName: orderInfo?.client?.name || 'Desconocido',
                         clientId: orderInfo?.client?.id,
                         orderId,
                         amount: expectedAmount,
                         method,
                         receiptUrl,
                         uploadedByName: uploadedByName || null,
                         auditErrors: null
                     });
                 } catch (emailErr) {
                     console.error('[ReceiptAgent] No se pudo enviar el email de comprobante:', emailErr);
                 }
             }
        }
    }
}
