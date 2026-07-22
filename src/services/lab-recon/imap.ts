import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { prisma } from '../../lib/db';
import { OptovisionParserService } from '../optovision-parser.service';
import { upsertEntry } from './cost-matching';

/**
 * INGESTA POR EMAIL (Optovision / Essilor): las facturas de Optovision no tienen
 * portal — llegan como PDF adjunto a la casilla, y ese email es la única fuente
 * de su costo real. Acá se lee la casilla, se parsean los PDF y se vuelcan al
 * cruce; también el "Resumen de cuenta" semanal de Essilor, que es la cuenta
 * corriente oficial (la deuda viva).
 *
 * Las credenciales van SIEMPRE apareadas por casilla: mezclar el usuario de una
 * con la clave de otra autentica mal o —peor— entra a la casilla equivocada y
 * devuelve 0 facturas con el watchdog en verde.
 */

/**
 * Abre una conexión IMAP a Gmail con las credenciales configuradas.
 * Las credenciales van SIEMPRE apareadas por casilla (user+password del mismo
 * par de variables): mezclar el user de una casilla con la clave de otra
 * autentica mal o —peor— autentica en la casilla equivocada.
 *
 * Si la dupla IMAP dedicada (IMAP_USER/IMAP_PASSWORD — la casilla personal
 * donde entran las facturas) está configurada y falla, se LANZA el error en
 * vez de caer a la casilla del CRM: allá no llegan facturas de Optovision, y
 * un "escaneo exitoso con 0 emails" dejaría el watchdog en verde mientras la
 * ingesta está muerta. Mejor una falla ruidosa que un silencio verde.
 * Devuelve null si no hay credenciales configuradas.
 */
export async function openImap(): Promise<any | null> {
    const dedicated = process.env.IMAP_USER && process.env.IMAP_PASSWORD
        ? { user: process.env.IMAP_USER, password: process.env.IMAP_PASSWORD }
        : null;
    const smtpPair = process.env.EMAIL_USER && process.env.EMAIL_PASS
        ? { user: process.env.EMAIL_USER, password: process.env.EMAIL_PASS }
        : null;
    const candidates = dedicated ? [dedicated] : (smtpPair ? [smtpPair] : []);
    if (candidates.length === 0) return null;

    let lastError: any = null;
    for (const cred of candidates) {
        try {
            return await imaps.connect({
                imap: {
                    user: cred.user!, password: cred.password!,
                    host: 'imap.gmail.com', port: 993, tls: true,
                    // servername: node-imap no manda SNI al upgradear el socket a TLS
                    // y Gmail ya lo exige (sin SNI responde un cert self-signed
                    // "No SNI provided - please fix your client").
                    tlsOptions: { servername: 'imap.gmail.com', rejectUnauthorized: false }, authTimeout: 10000,
                },
            });
        } catch (err: any) {
            lastError = err;
            console.warn(`[LabCost] IMAP no autenticó con ${cred.user}; probando la siguiente credencial…`);
        }
    }
    throw lastError || new Error('IMAP sin conexión');
}


/**
 * Escanea la casilla IMAP buscando facturas PDF de Optovision de los últimos
 * `sinceDays` días y registra cada una en la conciliación.
 */
export async function scanOptovisionInbox(sinceDays = 35) {
    const connection = await openImap();
    if (!connection) {
        console.warn('[LabCost] Sin credenciales IMAP/EMAIL configuradas. Se omite el escaneo.');
        return { skipped: true, reason: 'no_imap_password' };
    }

    const summary = { emails: 0, pdfs: 0, parsed: 0, unparsed: 0, overcost: 0, unmatched: 0, entries: [] as string[] };

    try {
        await connection.openBox('INBOX');

        const since = new Date();
        since.setDate(since.getDate() - sinceDays);

        const messages = await connection.search(
            [['FROM', 'procesos@optovisionsa.com.ar'], ['SINCE', since]],
            { bodies: [''], markSeen: false }
        );
        summary.emails = messages.length;
        console.log(`[LabCost] ${messages.length} emails de Optovision desde ${since.toISOString().slice(0, 10)}`);

        for (const msg of messages) {
            try {
            const allPart = msg.parts.find((p: any) => p.which === '');
            if (!allPart) continue;

            const parsed = await simpleParser(allPart.body);
            for (const attachment of parsed.attachments || []) {
                if (attachment.contentType !== 'application/pdf') continue;
                summary.pdfs++;

                try {
                    const invoice = await OptovisionParserService.parseInvoice(attachment.content);
                    const peds = invoice.labOrderNumbers;
                    if (peds.length === 0) {
                        // Compras de stock o consolidadas por remito: sin nº de
                        // pedido, no se cruzan (quedan solo en el log).
                        summary.unparsed++;
                        console.log(`[LabCost] PDF sin nº de pedido (stock/remito): ${attachment.filename}`);
                        continue;
                    }

                    // Una factura puede agrupar 2-3 pedidos: se registra cada
                    // uno con su parte proporcional del importe.
                    for (const ped of peds) {
                        const entry = await upsertEntry({
                            lab: 'OPTOVISION',
                            labOrderNumber: ped,
                            billedNet: invoice.subtotal !== null ? invoice.subtotal / peds.length : null,
                            billedTotal: invoice.total !== null ? invoice.total / peds.length : null,
                            source: 'IMAP_PDF',
                            sourceFile: attachment.filename || 'factura.pdf',
                            invoiceDate: parsed.date || null,
                            notes: peds.length > 1
                                ? `Factura compartida entre ${peds.length} pedidos (${peds.join(', ')}); importe prorrateado.`
                                : null,
                        });

                        if (entry) {
                            summary.parsed++;
                            summary.entries.push(entry.labOrderNumber);
                            if (entry.status === 'OVERCOST') summary.overcost++;
                            if (entry.status === 'UNMATCHED') summary.unmatched++;
                        }
                    }
                } catch (err) {
                    summary.unparsed++;
                    console.error(`[LabCost] Error parseando ${attachment.filename}:`, err);
                }
            }
            } catch (err) {
                // Un email malformado no debe frenar el resto del escaneo.
                summary.unparsed++;
                console.error('[LabCost] Error procesando un email de Optovision (se sigue con el próximo):', err);
            }
        }
    } finally {
        connection.end();
    }

    console.log(`[LabCost] Escaneo Optovision: ${JSON.stringify(summary)}`);
    return summary;
}


/**
 * CONTROL DE COBERTURA de la cuenta corriente: cruza cada factura del
 * resumen (serie-nro) con la conciliación — factura → pedido → venta o caso
 * de postventa. La regla del negocio: CADA número de operación de la cuenta
 * corriente tiene que tener su gemelo en el sistema (una venta o una
 * postventa que lo respalde); lo que no lo tiene queda marcado SIN gemelo.
 * Lo usa el escaneo del resumen (snapshot) y la página de costos (en vivo,
 * así el cruce se refresca a medida que entran facturas y ventas).
 */
export async function crossStatementRows(lab: string, rows: any[]) {
    const conocidas = await prisma.labCostEntry.findMany({
        where: { lab, sourceFile: { not: null } },
        select: {
            labOrderNumber: true, sourceFile: true, notes: true,
            order: { select: { labOrderNumber: true, client: { select: { name: true } } } },
        },
    });
    // Una factura puede agrupar 2-3 pedidos → mapa factura → entradas.
    const porFactura = new Map<string, typeof conocidas>();
    for (const e of conocidas) {
        const m = (e.sourceFile || '').match(/(\d{4})-?0*(\d{3,8})/);
        if (!m) continue;
        const k = `${m[1]}-${m[2].padStart(8, '0')}`;
        if (!porFactura.has(k)) porFactura.set(k, []);
        porFactura.get(k)!.push(e);
    }
    const enriched = rows.map((r: any) => {
        const entries = porFactura.get(r.invoiceNumber) || [];
        const best = entries.find(e => e.order) || entries[0] || null;
        const esPostventa = !!best?.notes?.includes('POSTVENTA (caso');
        return {
            ...r,
            enSistema: entries.length > 0,
            gemelo: best ? {
                pedido: best.labOrderNumber,
                tipo: best.order ? (esPostventa ? 'POSTVENTA' : 'VENTA') : 'SIN_VENTA',
                cliente: best.order?.client?.name ?? null,
                ventaPedidos: best.order?.labOrderNumber ?? null,
            } : null,
        };
    });
    const cuenta = (t: string) => enriched.filter((r: any) => r.gemelo?.tipo === t).length;
    const conVenta = cuenta('VENTA'), conPostventa = cuenta('POSTVENTA');
    return {
        rows: enriched,
        conVenta,
        conPostventa,
        sinGemelo: enriched.length - conVenta - conPostventa,
    };
}


/**
 * Escanea la casilla IMAP buscando el ÚLTIMO resumen de cuenta de Essilor
 * ("Documentos Pendientes" de procesos@essilor.com.ar), lo parsea y guarda un
 * snapshot de la cuenta corriente de Optovision (deuda total + saldo por
 * factura). Cruza cada factura del resumen con los pedidos conocidos.
 * Idempotente: no duplica si ya se guardó un resumen de esa fecha.
 */
export async function scanEssilorStatement(sinceDays = 20) {
    const { parseEssilorStatement } = await import('../lab-providers/essilor-statement');
    const connection = await openImap();
    if (!connection) return { skipped: true, reason: 'no_imap_password' };

    try {
        await connection.openBox('INBOX');
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        const messages = await connection.search(
            [['FROM', 'procesos@essilor.com.ar'], ['SINCE', since]],
            { bodies: [''], markSeen: false }
        );
        if (messages.length === 0) return { skipped: true, reason: 'sin_resumen', emails: 0 };

        // Tomar el MÁS RECIENTE (el resumen es acumulativo: el último manda).
        let best: { date: Date; pdf: Buffer; filename: string } | null = null;
        for (const msg of messages) {
            const allPart = msg.parts.find((p: any) => p.which === '');
            if (!allPart) continue;
            const parsed = await simpleParser(allPart.body);
            const pdf = (parsed.attachments || []).find((a: any) =>
                a.contentType === 'application/pdf' || /\.pdf$/i.test(a.filename || ''));
            if (!pdf) continue;
            const d = parsed.date || new Date(0);
            if (!best || d > best.date) best = { date: d, pdf: pdf.content, filename: pdf.filename || 'resumen.pdf' };
        }
        if (!best) return { skipped: true, reason: 'sin_pdf', emails: messages.length };

        const st = await parseEssilorStatement(best.pdf);
        if (!st.rows.length || st.totalDebt === null) {
            return { skipped: true, reason: 'no_parseado', emails: messages.length };
        }
        // Guarda de cordura: un resumen real de Optovision trae decenas de
        // facturas y una deuda de millones. Si el parseo devuelve 1-2 filas
        // con un total de monedas es que el layout del PDF cambió y se está
        // leyendo cualquier cosa (pasó el 22/7: "deuda $40,30") — mejor no
        // guardar un dato falso en la cuenta corriente y avisar por el log.
        if (st.rows.length < 5 && st.totalDebt < 100000) {
            console.error(`[LabCost] Resumen Essilor SOSPECHOSO (filas=${st.rows.length}, total=${st.totalDebt}): no se guarda; revisar el parser.`);
            return { skipped: true, reason: 'parse_sospechoso', filas: st.rows.length, total: st.totalDebt };
        }

        const statementDate = st.statementDate || best.date;
        // Idempotencia: no re-guardar el mismo resumen (mismo día + mismo total).
        const dup = await prisma.labAccountStatement.findFirst({
            where: { lab: 'OPTOVISION', statementDate, totalDebt: st.totalDebt },
        });

        // Cruce de cobertura: factura → pedido → venta/postventa (gemelo).
        const cruce = await crossStatementRows('OPTOVISION', st.rows);
        const rowsEnriquecidas = cruce.rows;
        const sinFacturaEnSistema = rowsEnriquecidas.filter((r: any) => !r.enSistema);

        if (!dup) {
            await prisma.labAccountStatement.create({
                data: {
                    lab: 'OPTOVISION', statementDate, totalDebt: st.totalDebt,
                    invoiceCount: st.rows.length, rows: rowsEnriquecidas as any,
                    sourceFile: best.filename,
                },
            });
        } else {
            // Mismo resumen: refrescar el cruce guardado (las facturas y
            // ventas pueden haber entrado DESPUÉS de guardar el snapshot).
            await prisma.labAccountStatement.update({
                where: { id: dup.id },
                data: { rows: rowsEnriquecidas as any },
            }).catch(err => console.error('[LabCost] Error refrescando cruce del resumen:', err));
        }
        return {
            ok: true, emails: messages.length, statementDate,
            totalDebt: st.totalDebt, invoiceCount: st.rows.length,
            conVenta: cruce.conVenta, conPostventa: cruce.conPostventa,
            sinGemelo: cruce.sinGemelo,
            sinFacturaEnSistema: sinFacturaEnSistema.length, nuevo: !dup,
        };
    } finally {
        connection.end();
    }
}

