import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { prisma } from '../lib/db';
import { OptovisionParserService } from './optovision-parser.service';
import { sendEmail } from '../lib/email';
import { RESOLUCIONES_CONOCIDAS } from './lab-providers/resoluciones';
import { logAudit } from '../lib/audit';
import { notificationEmailFor, ISHTAR_INBOX, firstName } from '../lib/vendor-email';

export type LabName = 'OPTOVISION' | 'GRUPO_OPTICO';

export interface LabCostInput {
    lab: LabName | string;
    labOrderNumber: string;
    billedNet?: number | null;
    billedTotal?: number | null;
    source: 'IMAP_PDF' | 'CSV' | 'SCRAPER' | 'MANUAL';
    sourceFile?: string | null;
    invoiceDate?: Date | null;
    notes?: string | null;
    /**
     * Pase rápido (ventana corta): sus importes se calculan con un conjunto
     * TRUNCADO de comprobantes, así que si la entrada ya tiene facturación de una
     * pasada completa, se conserva la existente (evita el ping-pong OK↔OVERCOST
     * entre la corrida de 10 min y la diaria). Solo completa lo que falta.
     */
    preferExistingBilling?: boolean;
}

// Tolerancia en pesos para diferencias de redondeo entre lista y factura.
const TOLERANCE = 100;

// Optovision factura unos días antes de terminar el pedido: recién a los N días
// hábiles de la factura se lo da por terminado (5 = margen "por si acaso").
const OPTOVISION_DIAS_FACTURA_A_LISTO = 5;

// Qué ítems de la orden pertenecen a cada laboratorio (el resto de la orden
// —armazón, accesorios— no lo factura el lab y no debe entrar en el cruce).
const LAB_ITEM_PATTERNS: Record<string, RegExp> = {
    OPTOVISION: /optovision/i,
    GRUPO_OPTICO: /grupo[\s\-]?[oó]ptico/i,
};

export class LabCostReconciliationService {

    /**
     * MODO BACKFILL POR LABORATORIO (estreno en producción): mientras un lab no
     * tenga su backfill completo, sus entradas se registran y cruzan pero SIN
     * emails, SIN flip a FINISHED y SIN notificaciones — y quedan marcadas como
     * ya alertadas. Evita el aluvión retroactivo (35 días de facturas de golpe =
     * decenas de emails + WhatsApps de "listo para retirar" a clientes de pedidos
     * viejos ya entregados). El flag es POR PROVEEDOR y lo setea el cron diario
     * SOLO tras una corrida exitosa de ese proveedor: si IMAP falla el día 1, el
     * histórico de Optovision sigue en silencio hasta que su backfill de verdad
     * ocurra (con un flag global, esa falla parcial soltaba el aluvión al día
     * siguiente). Se lee de la DB con un cache corto — sin contadores en memoria
     * que puedan quedar clavados si una corrida se cuelga.
     */
    static BACKFILL_LABS = ['OPTOVISION', 'GRUPO_OPTICO'] as const;
    static backfillKey(lab: string) { return `lab_recon_backfill_done:${lab}`; }
    private static backfillCache: { at: number; done: Record<string, boolean> } | null = null;

    static async isQuietLab(lab: string): Promise<boolean> {
        const now = Date.now();
        if (!this.backfillCache || now - this.backfillCache.at > 60_000) {
            const keys = this.BACKFILL_LABS.map(l => this.backfillKey(l));
            const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
                .catch(() => [] as { key: string; value: string }[]);
            const done: Record<string, boolean> = {};
            for (const l of this.BACKFILL_LABS) {
                done[l] = rows.some(r => r.key === this.backfillKey(l) && !!r.value);
            }
            this.backfillCache = { at: now, done };
        }
        // Solo los labs conocidos entran en modo silencioso pre-backfill.
        return this.backfillCache.done[lab] === false;
    }

    static invalidateBackfillCache() { this.backfillCache = null; }

    /** Emails de alerta habilitados: en local solo con FORCE_LAB_ALERTS=1. */
    private static emailsEnabled(): boolean {
        return process.env.NODE_ENV === 'production' || process.env.FORCE_LAB_ALERTS === '1';
    }

    /**
     * Costo de sistema de una orden para un laboratorio dado: suma solo los ítems
     * de ese lab (snapshot primero, costo vivo como fallback). Si ningún ítem
     * matchea el lab, cae a los ítems de categoría Cristal; si tampoco, a todos.
     *
     * REGLA POR PAR: el costo de los cristales se carga POR PAR (ambos ojos) en
     * el producto, pero la venta los guarda como DOS ítems (eye OD/OI), cada uno
     * con el snapshot del par completo. Por eso cada ítem con ojo cuenta la MITAD
     * — así el total de la venta es un solo par, igual que factura el lab
     * (2 líneas de 0.50 × unitario por par). Un solo ojo vendido = medio par.
     */
    static systemCostForLab(order: any, lab: string): number {
        const items: any[] = order.items || [];
        if (items.length === 0) return 0;

        const pattern = LAB_ITEM_PATTERNS[lab];
        const labOf = (item: any) => item.laboratorySnapshot || item.product?.laboratory || '';
        const categoryOf = (item: any) => item.productCategorySnapshot || item.product?.category || '';

        let relevant = pattern ? items.filter(i => pattern.test(labOf(i))) : [];
        if (relevant.length === 0) relevant = items.filter(i => /cristal/i.test(categoryOf(i)));
        if (relevant.length === 0) relevant = items;

        // En una venta 2x1 el par gratis (cristal con price 0) le cuesta al lab SOLO el
        // calibrado, no el costo de lista del cristal. Contarlo entero infla el systemCost
        // y enmascara un sobrecosto real. Mismo criterio que report.service.
        const is2x1 = (order.appliedPromoName || '').toLowerCase().includes('2x1')
            || items.some((i: any) => /cristal/i.test(categoryOf(i)) && i.price === 0);
        const CALIBRADO_COST = 15000 * 1.21; // fallback calibrado + IVA (igual que report.service)

        return relevant.reduce((total, item) => {
            const perEyeHalf = item.eye ? 0.5 : 1;
            const isCrystal = /cristal/i.test(categoryOf(item));
            if (is2x1 && isCrystal && item.price === 0) {
                return total + CALIBRADO_COST * perEyeHalf * (item.quantity || 1);
            }
            const cost = item.productCostSnapshot ?? item.product?.cost ?? 0;
            return total + cost * perEyeHalf * (item.quantity || 1);
        }, 0);
    }

    /**
     * Registra (o actualiza) el costo facturado por el lab para un nº de pedido,
     * lo cruza contra la orden del CRM y dispara alerta si hay sobrecosto nuevo.
     * Devuelve la entrada resultante.
     */
    static async upsertEntry(input: LabCostInput) {
        const cleanNumber = (input.labOrderNumber.match(/\d{4,}/) || [input.labOrderNumber.trim()])[0];
        if (!cleanNumber) return null;

        // Backfill pendiente para este lab → modo silencioso (ver arriba).
        const quiet = await this.isQuietLab(String(input.lab));

        // Buscar la venta cuyo labOrderNumber contiene ese número (o un caso de
        // postventa que generó un pedido nuevo con ese número).
        const candidatos = await prisma.order.findMany({
            where: {
                isDeleted: false,
                OR: [
                    { labOrderNumber: { contains: cleanNumber } },
                    { postSaleCases: { some: { newOrderNumber: { contains: cleanNumber } } } },
                ],
            },
            include: {
                client: { select: { name: true } },
                items: { include: { product: { select: { name: true, cost: true, laboratory: true, category: true } } } },
                postSaleCases: {
                    select: { id: true, newOrderNumber: true, caseType: true, coverage: true, fault: true, cost: true },
                    orderBy: { createdAt: 'desc' as const },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        // El `contains` puede matchear por SUBSTRING (p. ej. "12345" dentro de
        // "612345", o un nº de otro lab): quedarse con el candidato cuyo número
        // sea EXACTAMENTE uno de los pedidos de la venta — y recién si no hay,
        // con el que matchee exacto por caso de postventa. Mirar TODOS los
        // candidatos: con uno solo, una venta más nueva que matchea por substring
        // eclipsaba a la venta correcta. Sin match exacto → huérfano (mejor un
        // huérfano visible que colgar la factura de la venta equivocada).
        const numbersOf = (s: string | null | undefined): string[] => s?.match(/\d{4,}/g) || [];
        const order =
            candidatos.find(o => numbersOf(o.labOrderNumber).includes(cleanNumber))
            ?? candidatos.find(o => o.postSaleCases?.some((c: any) => numbersOf(c.newOrderNumber).includes(cleanNumber)))
            ?? null;

        // ¿El número matcheó por POSTVENTA (reproceso) y no por la venta original?
        const pvCase = order?.postSaleCases?.find((c: any) => numbersOf(c.newOrderNumber).includes(cleanNumber)) || null;

        const existing = await prisma.labCostEntry.findUnique({
            where: { lab_labOrderNumber: { lab: input.lab, labOrderNumber: cleanNumber } },
        });

        // Una fuente sin importes (p. ej. el barrido del portal) NUNCA debe pisar
        // la facturación ya registrada por otra fuente (planilla, PDF de email).
        const hasNewBilling = input.billedNet != null || input.billedTotal != null;
        const keepExistingBilling = !hasNewBilling && !!existing
            && (existing.billedNet !== null || existing.billedTotal !== null);

        // Y al revés: el pase RÁPIDO (ventana corta) no pisa importes registrados
        // por una pasada completa — su reparto de líneas se calcula con menos
        // comprobantes y "corregiría" para atrás (ping-pong de estados y re-alertas).
        const preferExisting = keepExistingBilling ||
            (!!input.preferExistingBilling && !!existing && (existing.billedNet !== null || existing.billedTotal !== null));

        const billedNet = preferExisting ? existing!.billedNet : (input.billedNet ?? null);
        const billedTotal = preferExisting ? existing!.billedTotal : (input.billedTotal ?? null);
        const source = preferExisting ? existing!.source : input.source;
        const sourceFile = preferExisting
            ? existing!.sourceFile
            : (input.sourceFile ?? existing?.sourceFile ?? null);
        // La fecha de factura nunca se borra: la nueva si viene, si no la que había.
        const invoiceDate = preferExisting
            ? (existing!.invoiceDate ?? input.invoiceDate ?? null)
            : (input.invoiceDate ?? existing?.invoiceDate ?? null);

        // Comparable por laboratorio: Optovision discrimina IVA y Atelier es
        // monotributo (no lo recupera) → el costo real es el TOTAL c/IVA.
        // Grupo Óptico factura a consumidor final → neto y total coinciden.
        const billedComparable = input.lab === 'OPTOVISION'
            ? (billedTotal ?? billedNet ?? null)
            : (billedNet ?? billedTotal ?? null);
        const systemCost = order ? this.systemCostForLab(order, input.lab) : null;

        // Una venta puede tener varios pedidos de lab ("580841-580844", típico en
        // 2x1: el lab cobra un par real y el otro ~$0). El costo sistema es de TODA
        // la venta, así que la comparación debe ser a NIVEL VENTA: sumar las
        // facturas de TODOS sus pedidos (cada uno buscado individualmente), no la
        // de un solo pedido. Si a algún pedido de la venta le falta factura, la
        // venta está incompleta → PENDING (no un falso ahorro/sobrecosto).
        const orderNumbers = numbersOf(order?.labOrderNumber);
        const multiPedido = orderNumbers.length > 1;

        // Entrada de POSTVENTA pura: matcheó por un caso de postventa y su número
        // NO es uno de los pedidos de la venta original. Un reproceso NO entra en
        // el cruce de costo de la venta (compararía la garantía de ~$0 contra el
        // costo del par completo → falso "a favor" en cada reproceso). Su auditoría
        // es sendChargedReworkAlert: si el reproceso vino CON cargo, alerta.
        const pvEntry = !!pvCase && !orderNumbers.includes(cleanNumber);

        // Comparable a nivel venta: importe de este pedido + el de sus hermanos ya
        // registrados (misma venta, otro nº DE LA VENTA — las entradas de postventa
        // que comparten orderId no cuentan como pedidos de la venta). Y cuántos
        // pedidos de la venta ya tienen factura, para saber si está completa.
        const billedForLab = (e: { billedNet: number | null; billedTotal: number | null }) =>
            input.lab === 'OPTOVISION' ? (e.billedTotal ?? e.billedNet ?? null) : (e.billedNet ?? e.billedTotal ?? null);
        let saleBilled = billedComparable;
        let facturadosEnVenta = billedComparable !== null ? 1 : 0;
        // Principal de la venta = pedido de mayor importe facturado; a igualdad,
        // el nº de pedido menor. Garantiza EXACTAMENTE un principal (una sola
        // alerta por venta), tanto si el 2º par va gratis como si se cobra igual.
        const myBilled = billedComparable ?? 0;
        let isPrimaryOfSale = true;
        if (multiPedido && order && !pvEntry) {
            const siblings = await prisma.labCostEntry.findMany({
                where: {
                    orderId: order.id,
                    labOrderNumber: { in: orderNumbers.filter(n => n !== cleanNumber) },
                },
                select: { labOrderNumber: true, billedNet: true, billedTotal: true },
            });
            for (const s of siblings) {
                const b = billedForLab(s);
                if (b !== null) { saleBilled = (saleBilled ?? 0) + b; facturadosEnVenta++; }
                const sb = b ?? 0;
                if (sb > myBilled || (sb === myBilled && s.labOrderNumber < cleanNumber)) isPrimaryOfSale = false;
            }
        }
        const ventaCompleta = !multiPedido || facturadosEnVenta >= orderNumbers.length;

        // UNMATCHED = sin venta en el sistema (¡pedido huérfano si vino del portal!)
        // PENDING   = con venta pero sin todas las facturas de la venta todavía
        let status = 'UNMATCHED';
        let difference: number | null = null;
        if (order && pvEntry) {
            // Reproceso: fuera del cruce de costo. PENDING hasta que llegue su
            // importe; con importe queda OK (la alerta de reproceso cobrado corre
            // aparte, más abajo).
            status = billedComparable === null ? 'PENDING' : 'OK';
        } else if (order && (billedComparable === null || !ventaCompleta)) {
            status = 'PENDING';
        } else if (order && saleBilled !== null && systemCost !== null) {
            difference = saleBilled - systemCost;
            if (difference > TOLERANCE) status = 'OVERCOST';
            else if (difference < -TOLERANCE) status = 'UNDERCOST';
            else status = 'OK';
        }

        // Conservar las notas existentes (p. ej. la del portal) cuando la
        // actualización no trae nota propia, y no duplicar la de multi-pedido.
        const baseNotes = input.notes ?? existing?.notes ?? null;
        const multiNote = multiPedido && !baseNotes?.includes('pedidos de lab')
            ? `La venta tiene ${orderNumbers.length} pedidos de lab (${order!.labOrderNumber}); el costo sistema es el total de la venta.`
            : null;
        // Resolución conocida del administrador (p. ej. "COSTO VENDEDOR"): queda
        // fija en el detalle de la entrada, venga de la fuente que venga.
        const resolucion = RESOLUCIONES_CONOCIDAS[cleanNumber];
        const resolucionNote = resolucion && !baseNotes?.includes('RESUELTO') ? resolucion : null;
        const pvNote = pvCase && !baseNotes?.includes('POSTVENTA (caso')
            ? `Pedido de POSTVENTA (caso ${pvCase.caseType || 's/tipo'}${pvCase.coverage ? `, cobertura: ${pvCase.coverage}` : ''}).`
            : null;
        // El marcador de "reproceso cobrado ya avisado" sobrevive a los rearmados
        // de notas (el proveedor manda su nota en cada corrida y la pisaría —
        // perdiendo el dedupe y reenviando la alerta en cada pasada).
        const reworkMark = existing?.notes?.includes('[Reproceso cobrado avisado]') && !baseNotes?.includes('[Reproceso cobrado avisado]')
            ? '[Reproceso cobrado avisado]' : null;
        const notes = [resolucionNote, pvNote, baseNotes, multiNote, reworkMark].filter(Boolean).join(' ') || null;

        const data = {
            orderId: order?.id ?? null,
            // Un reproceso no participa del cruce de costo de la venta: mostrar el
            // costo del sistema ahí sería comparar peras con garantías.
            systemCost: pvEntry ? null : systemCost,
            billedNet,
            billedTotal,
            difference,
            source,
            sourceFile,
            invoiceDate,
            status,
            notes,
            // Backfill: todo lo histórico queda marcado como ya alertado, así el
            // régimen normal solo avisa lo NUEVO desde el estreno del sistema.
            ...(quiet ? { alertedAt: new Date(), alertedStatus: status } : {}),
        };

        const entry = existing
            ? await prisma.labCostEntry.update({ where: { id: existing.id }, data })
            : await prisma.labCostEntry.create({
                data: { lab: input.lab, labOrderNumber: cleanNumber, ...data },
            });

        // Comparable del importe previo con el MISMO criterio por lab que el nuevo
        // (para Optovision total-c/IVA-primero): comparar neto viejo contra total
        // nuevo hacía que "cambió el importe" diera true en cada corrida.
        const prevBilled = existing ? billedForLab(existing) : null;
        // "Llegó la factura": el pedido no tenía importe y ahora sí.
        const facturaRecienLlegada = billedComparable !== null && prevBilled === null;

        // OPTOVISION (pedidos de alto valor): avisar por CADA factura que ingresa,
        // diga lo que diga (coincide / sobrecosto / menor). Cruza de quién es,
        // asigna el monto e informa en el momento. Cubre también el sobrecosto,
        // así que para Optovision no se manda además la alerta genérica.
        // Los reprocesos (pvEntry) no entran acá: su auditoría es la alerta de
        // reproceso cobrado, más abajo. Al avisar una venta multi-pedido se marcan
        // también sus hermanos con el MISMO estado a nivel venta: el hallazgo es
        // uno solo — sin esto, el par $0 del 2x1 reaparecía después como fila
        // suelta en el barrido (email duplicado por la misma venta).
        const markSale = async () => {
            if (multiPedido && order) {
                await prisma.labCostEntry.updateMany({
                    where: { lab: input.lab, orderId: order.id, labOrderNumber: { in: orderNumbers } },
                    data: { alertedAt: new Date(), alertedStatus: status },
                }).catch(err => console.error('[LabCost] Error marcando hermanos de la venta:', err));
            } else {
                await this.markAlerted(entry.id, status);
            }
        };
        if (input.lab === 'OPTOVISION' && order && !pvEntry && !quiet && facturaRecienLlegada && isPrimaryOfSale) {
            await this.sendInvoiceArrivalAlert(entry, order, {
                saleBilled, systemCost, status, difference, pvCase,
                ventaCompleta, faltan: Math.max(0, orderNumbers.length - facturadosEnVenta),
            }).then(ok => { if (ok) return markSale(); })
                .catch(err => console.error('[LabCost] Error enviando aviso de factura Optovision:', err));
        } else {
            // Resto de labs (Grupo Óptico): alerta solo cuando el sobrecosto es
            // nuevo, una vez por venta, sin repetir en cada corrida.
            const isNewOvercost = status === 'OVERCOST' && (!existing || existing.status !== 'OVERCOST');
            if (isNewOvercost && order && !quiet && isPrimaryOfSale) {
                await this.sendOvercostAlert(entry, order)
                    .then(ok => { if (ok) return markSale(); })
                    .catch(err => console.error('[LabCost] Error enviando alerta de sobrecosto:', err));
            }
        }

        // Auditoría de POSTVENTA: un reproceso debería venir sin cargo (garantía;
        // Optovision los factura a ~$0). Si el pedido nació de un caso de postventa
        // y la factura trae plata, alertar apenas aparece el importe. El marcador
        // en las notas hace el aviso PERSISTENTE: si el email falla se reintenta en
        // la próxima corrida, y una vez enviado no se repite nunca (antes dependía
        // de "cambió el importe": un envío fallido se perdía para siempre).
        const REWORK_MARK = '[Reproceso cobrado avisado]';
        if (pvCase && order && billedComparable !== null && billedComparable > 5000
            && !(entry.notes || '').includes(REWORK_MARK)) {
            const stamp = () => prisma.labCostEntry.update({
                where: { id: entry.id },
                data: { notes: `${entry.notes ? entry.notes + ' ' : ''}${REWORK_MARK}` },
            }).catch(err => console.error('[LabCost] Error estampando aviso de reproceso:', err));
            if (quiet) {
                // Backfill: el reproceso histórico queda registrado sin avisar.
                await stamp();
            } else if (this.emailsEnabled()) {
                const ok = await this.sendChargedReworkAlert(entry, order, pvCase, billedComparable)
                    .catch(err => { console.error('[LabCost] Error enviando alerta de reproceso cobrado:', err); return false; });
                if (ok) await stamp();
            }
        }

        // COSTO DEL CASO DE POSTVENTA: con la factura del lab ya se conoce el
        // costo real del caso → se completa el campo Costo del caso (sin pisar
        // lo cargado a mano), se deja nota firmada en el caso y se le avisa por
        // email al vendedor que lo cargó, con copia a Ishtar. Solo cuando el
        // importe RECIÉN llega (así lo histórico pre-feature no dispara nada) y
        // fuera del backfill. Vale para ambos labs.
        if (pvCase && order && billedComparable !== null && facturaRecienLlegada && !quiet) {
            await this.completePostSaleCost(entry, order, pvCase, billedComparable, cleanNumber)
                .catch(err => console.error('[LabCost] Error completando costo de postventa:', err));
        }

        // FACTURA = PEDIDO MÁS CERCA (regla del negocio, corregida por el
        // administrador): cuando Optovision factura, al pedido todavía le faltan
        // ~5 días hábiles para estar terminado — NO está listo. Acá solo se
        // adelanta el estado a "Procesado" (IN_PROGRESS) si venía más atrás; la
        // promoción a FINISHED (con su notificación LAB_READY y el circuito de
        // retiro) la hace promoteFinishedOptovision() recién cuando pasaron los
        // 5 días hábiles desde la factura. Guardas: solo cuando la factura RECIÉN
        // llega (persistente vía el importe guardado), sin reprocesos, sin backfill.
        if (input.lab === 'OPTOVISION' && order && !pvEntry && facturaRecienLlegada && !quiet) {
            const previa = order.labStatus || 'NONE';
            if (previa === 'NONE' || previa === 'SENT') {
                await prisma.order.update({ where: { id: order.id }, data: { labStatus: 'IN_PROGRESS' } })
                    .catch(err => console.error('[LabCost] Error adelantando pedido Optovision a Procesado:', err));
            }
        }

        return entry;
    }

    /**
     * Aviso de CORROBORACIÓN para pedidos de Optovision facturados (regla del
     * administrador): la factura llega unos días hábiles antes de que el pedido
     * esté terminado. Cuando (a) TODAS las operaciones de la venta tienen factura
     * y (b) la última factura ya tiene 5+ días hábiles, el pedido YA DEBERÍA
     * estar terminado — pero NO se marca solo: se genera una notificación
     * "corroborar con el laboratorio" (tipo LAB_CHECK, una sola vez por venta) y
     * el estado lo cambia un humano cuando confirma. Corre en cada pase (10 min
     * y diario). Garantías anti-retroactivo: solo entradas creadas DESPUÉS del
     * backfill inicial de Optovision; FINISHED/READY/DELIVERED no se tocan.
     */
    static async promoteFinishedOptovision() {
        const flag = await prisma.systemSetting.findUnique({
            where: { key: this.backfillKey('OPTOVISION') },
        });
        if (!flag?.value) return { promoted: 0, reason: 'backfill_pendiente' };
        const backfillAt = new Date(flag.value);
        if (isNaN(backfillAt.getTime())) return { promoted: 0, reason: 'flag_invalido' };

        // Candidatas: entradas post-backfill, con venta y con importe.
        const entradas = await prisma.labCostEntry.findMany({
            where: {
                lab: 'OPTOVISION',
                createdAt: { gt: backfillAt },
                orderId: { not: null },
                OR: [{ billedTotal: { not: null } }, { billedNet: { not: null } }],
                order: { is: { isDeleted: false, labStatus: { in: ['NONE', 'SENT', 'IN_PROGRESS'] } } },
            },
            include: {
                order: {
                    select: {
                        id: true, labStatus: true, labOrderNumber: true,
                        client: { select: { name: true } },
                    },
                },
            },
        });
        if (entradas.length === 0) return { promoted: 0 };

        // Días hábiles (lun-vie) COMPLETOS transcurridos desde una fecha.
        const habilesDesde = (desde: Date): number => {
            let count = 0;
            const d = new Date(desde);
            d.setHours(0, 0, 0, 0);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            while (d < hoy) {
                d.setDate(d.getDate() + 1);
                const dow = d.getDay();
                if (dow !== 0 && dow !== 6) count++;
            }
            return count;
        };

        const porVenta = new Map<string, typeof entradas>();
        for (const e of entradas) {
            if (!porVenta.has(e.orderId!)) porVenta.set(e.orderId!, []);
            porVenta.get(e.orderId!)!.push(e);
        }

        let promoted = 0;
        for (const [orderId, grupo] of porVenta) {
            const order = grupo[0].order!;
            const nums = order.labOrderNumber?.match(/\d{4,}/g) || [];
            if (nums.length === 0) continue;

            // TODAS las operaciones de la venta tienen que estar facturadas (las
            // entradas pueden ser pre o post backfill: mirar la DB completa).
            const todas = await prisma.labCostEntry.findMany({
                where: { lab: 'OPTOVISION', orderId, labOrderNumber: { in: nums } },
                select: { labOrderNumber: true, billedNet: true, billedTotal: true, invoiceDate: true, createdAt: true },
            });
            const facturadas = todas.filter(t => t.billedTotal !== null || t.billedNet !== null);
            if (facturadas.length < nums.length) continue;

            // 5+ días hábiles desde la ÚLTIMA factura de la venta (fecha del email
            // de la factura; si no la hay, cuándo la registramos).
            const ultima = Math.max(...facturadas.map(t => (t.invoiceDate ?? t.createdAt).getTime()));
            if (habilesDesde(new Date(ultima)) < OPTOVISION_DIAS_FACTURA_A_LISTO) continue;

            // Una sola vez por venta: si ya existe el aviso de corroboración
            // (pendiente o resuelto), no se repite.
            const yaAvisado = await prisma.notification.findFirst({
                where: { type: 'LAB_CHECK', orderId },
                select: { id: true },
            });
            if (yaAvisado) continue;

            await prisma.notification.create({
                data: {
                    type: 'LAB_CHECK',
                    message: `🔎 Optovision: facturado hace 5+ días hábiles — YA DEBERÍA ESTAR TERMINADO. Corroborar con el laboratorio y actualizar el estado — ${order.client?.name ?? 'cliente'} (${nums.join(', ')})`,
                    orderId,
                    requestedBy: 'Conciliación Optovision',
                    status: 'PENDING',
                },
            })
                .then(() => { promoted++; })
                .catch(err => console.error('[LabCost] Error creando aviso de corroboración Optovision:', err));
        }
        if (promoted > 0) console.log(`[LabCost] ${promoted} aviso(s) de corroboración Optovision creados (facturado hace 5+ días hábiles).`);
        return { promoted };
    }

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
    private static async openImap(): Promise<any | null> {
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
    static async scanOptovisionInbox(sinceDays = 35) {
        const connection = await this.openImap();
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
                            const entry = await this.upsertEntry({
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
    static async crossStatementRows(lab: string, rows: any[]) {
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
    static async scanEssilorStatement(sinceDays = 20) {
        const { parseEssilorStatement } = await import('./lab-providers/essilor-statement');
        const connection = await this.openImap();
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
            const cruce = await this.crossStatementRows('OPTOVISION', st.rows);
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

    /**
     * Snapshot del estado del cruce en este momento: cuántos pedidos se
     * corresponden con ventas, con postventa, y cuántos quedaron sin
     * correspondencia. Base del registro de auditoría diario.
     */
    static async reconciliationSnapshot() {
        const byStatus = await prisma.labCostEntry.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const count = (s: string) => byStatus.find(b => b.status === s)?._count._all || 0;
        // Postventa = entradas cuya nota las marca como pedido de postventa
        // (upsertEntry las anota "Pedido de POSTVENTA (caso …)").
        const postventa = await prisma.labCostEntry.count({
            where: { notes: { contains: 'POSTVENTA (caso' } },
        });
        const ok = count('OK'), overcost = count('OVERCOST'), undercost = count('UNDERCOST');
        const esperandoFact = count('PENDING'), sinVenta = count('UNMATCHED');
        return {
            totalEntries: ok + overcost + undercost + esperandoFact + sinVenta,
            conVenta: ok + overcost + undercost + esperandoFact, // todo lo que matchea una venta
            postventa,
            sinVenta,
            esperandoFact,
            ok,
            overcost,
            undercost,
        };
    }

    /**
     * Graba una fila en el libro de auditoría (LabAuditRun): deja constancia de
     * que la revisión diaria se ejecutó y con qué resultado. `providerResults` es
     * lo que devuelve runAllProviders; `nuevosSinVenta` los huérfanos nuevos.
     */
    static async recordAuditRun(opts: {
        trigger?: string;
        providerResults: Record<string, any>;
        staleSources?: string[];
        nuevosSinVenta?: number;
    }) {
        const snap = await this.reconciliationSnapshot();
        const providers: Record<string, any> = {};
        for (const [k, v] of Object.entries(opts.providerResults)) {
            if (k === 'health' || k === 'recheck') continue;
            providers[k] = v;
        }
        return prisma.labAuditRun.create({
            data: {
                trigger: opts.trigger || 'CRON',
                providers,
                staleSources: opts.staleSources || [],
                nuevosSinVenta: opts.nuevosSinVenta || 0,
                ...snap,
            },
        });
    }

    /**
     * Registra pedidos vistos en el portal del laboratorio que no corresponden
     * a ninguna venta del sistema (pedidos huérfanos: plata gastada en el lab
     * sin venta que la respalde). Si la venta aparece después, el re-cruce
     * diario los pasa a PENDING automáticamente.
     */
    static async registerPortalOrphans(
        lab: LabName | string,
        portalOrders: { num: string; client?: string; date?: string }[]
    ) {
        let registered = 0;
        for (const po of portalOrders) {
            const clean = (po.num.match(/\d{4,}/) || [])[0];
            if (!clean) continue;
            const detail = [po.client, po.date && `ingreso ${po.date}`].filter(Boolean).join(', ');
            const entry = await this.upsertEntry({
                lab,
                labOrderNumber: clean,
                billedNet: null,
                billedTotal: null,
                source: 'SCRAPER',
                notes: `Pedido visto en el portal del laboratorio${detail ? ` (${detail})` : ''}.`,
            });
            if (entry) registered++;
        }
        return registered;
    }

    /**
     * Reporte mensual: todas las ventas con ítems de laboratorio del mes
     * (por fecha de envío al lab, o de creación si nunca se envió), con costo
     * sistema, costo real facturado (si ya se cargó/escaneó) y diferencia.
     */
    /**
     * Resumen semanal de conciliación para ambos laboratorios: qué facturas
     * ingresaron en la ventana (por invoiceDate), montos, y el estado GLOBAL
     * vigente por lab (con venta / sin venta / esperando factura / sobrecostos).
     * Es la base del email de fin de semana para llevar la tratativa al día.
     */
    static async weeklyReport(from: Date, to: Date) {
        const entries = await prisma.labCostEntry.findMany({
            include: { order: { select: { clientId: true, client: { select: { name: true } } } } },
        });

        const billedOf = (e: any) => e.lab === 'OPTOVISION'
            ? (e.billedTotal ?? e.billedNet ?? null)
            : (e.billedNet ?? e.billedTotal ?? null);

        const perLab: Record<string, any> = {};
        for (const lab of ['OPTOVISION', 'GRUPO_OPTICO']) {
            const rows = entries.filter(e => e.lab === lab);
            const nuevasSemana = rows.filter(e => e.invoiceDate && e.invoiceDate >= from && e.invoiceDate < to);
            const facturadoSemana = nuevasSemana.reduce((t, e) => t + (billedOf(e) || 0), 0);
            const count = (s: string) => rows.filter(e => e.status === s).length;
            perLab[lab] = {
                totalPedidos: rows.length,
                facturasSemana: nuevasSemana.length,
                facturadoSemana,
                sinVenta: count('UNMATCHED'),
                esperandoFactura: count('PENDING'),
                ok: count('OK'),
                sobrecostos: count('OVERCOST'),
                menorCosto: count('UNDERCOST'),
                // Cuenta corriente / facturado acumulado por lab (todo lo que tiene importe).
                facturadoAcumulado: rows.reduce((t, e) => t + (billedOf(e) || 0), 0),
                // Detalle de las facturas de la semana (para la tabla del email).
                detalleSemana: nuevasSemana
                    .sort((a, b) => (b.invoiceDate!.getTime()) - (a.invoiceDate!.getTime()))
                    .map(e => ({
                        labOrderNumber: e.labOrderNumber,
                        cliente: e.order?.client?.name || (e.status === 'UNMATCHED' ? 'SIN VENTA' : '—'),
                        clientId: e.order?.clientId || null,
                        billed: billedOf(e),
                        systemCost: e.systemCost,
                        difference: e.difference,
                        status: e.status,
                        esPostventa: (e.notes || '').includes('POSTVENTA (caso'),
                    })),
            };
        }

        // Sobrecostos vigentes (para destacar arriba, sobre todo Optovision).
        const sobrecostosVigentes = entries
            .filter(e => e.status === 'OVERCOST')
            .map(e => ({ lab: e.lab, labOrderNumber: e.labOrderNumber, cliente: e.order?.client?.name || '—', difference: e.difference }))
            .sort((a, b) => (b.difference || 0) - (a.difference || 0));

        // Cuenta corriente (deuda) por lab según el último resumen recibido.
        const statements = await prisma.labAccountStatement.findMany({
            orderBy: { statementDate: 'desc' }, distinct: ['lab'],
        });
        const cuentaCorriente = statements.map(s => ({
            lab: s.lab, totalDebt: s.totalDebt, statementDate: s.statementDate, invoiceCount: s.invoiceCount,
        }));

        return { from, to, perLab, sobrecostosVigentes, cuentaCorriente };
    }

    // Include compartido por el reporte mensual y la búsqueda histórica.
    private static readonly REPORT_INCLUDE = {
        client: { select: { name: true } },
        items: { include: { product: { select: { name: true, cost: true, laboratory: true, category: true } } } },
    } as const;

    static async monthlyReport(year: number, month: number) {
        // Límites del mes en hora argentina (UTC-3).
        const desde = new Date(Date.UTC(year, month - 1, 1, 3));
        const hasta = new Date(Date.UTC(year, month, 1, 3));

        const orders = await prisma.order.findMany({
            where: {
                isDeleted: false,
                orderType: 'SALE',
                OR: [
                    { labSentAt: { gte: desde, lt: hasta } },
                    { labSentAt: null, createdAt: { gte: desde, lt: hasta } },
                ],
            },
            include: this.REPORT_INCLUDE,
            orderBy: { createdAt: 'asc' },
        });

        return this.assembleReport(orders, `${year}-${String(month).padStart(2, '0')}`);
    }

    /**
     * Igual que el reporte mensual pero SIN acotar al mes: busca en todo el
     * histórico por nombre de cliente o nº de pedido, y/o por un día puntual.
     * Devuelve el mismo shape (month: 'historico') para reusar la misma tabla.
     */
    static async searchReport(query?: string, day?: string) {
        const q = (query || '').trim();
        const conds: any[] = [];

        if (q) {
            conds.push({
                OR: [
                    { client: { name: { contains: q, mode: 'insensitive' } } },
                    { labOrderNumber: { contains: q, mode: 'insensitive' } },
                ],
            });
        }
        if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
            const [y, mo, d] = day.split('-').map(Number);
            const desde = new Date(Date.UTC(y, mo - 1, d, 3));
            const hasta = new Date(Date.UTC(y, mo - 1, d + 1, 3));
            conds.push({
                OR: [
                    { labSentAt: { gte: desde, lt: hasta } },
                    { labSentAt: null, createdAt: { gte: desde, lt: hasta } },
                ],
            });
        }

        // Sin ningún criterio no barremos toda la base: devolvemos vacío.
        if (conds.length === 0) return this.assembleReport([], 'historico');

        const orders = await prisma.order.findMany({
            where: { isDeleted: false, orderType: 'SALE', AND: conds },
            include: this.REPORT_INCLUDE,
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });

        return this.assembleReport(orders, 'historico');
    }

    /** Arma el reporte (filas + cruce con facturas + totales) a partir de un set de órdenes ya traído. */
    private static async assembleReport(orders: any[], monthLabel: string) {
        const anyLab = /(optovision|grupo[\s\-]?[oó]ptico)/i;
        const labOf = (item: any) => item.laboratorySnapshot || item.product?.laboratory || '';

        const rows = orders
            .map(order => {
                const labItems = (order.items || []).filter((i: any) => anyLab.test(labOf(i)));
                if (labItems.length === 0) return null;

                const lab = labItems.some((i: any) => LAB_ITEM_PATTERNS.OPTOVISION.test(labOf(i)))
                    ? 'OPTOVISION' : 'GRUPO_OPTICO';
                // Regla por par: cada ítem con ojo (OD/OI) lleva el costo del par
                // completo en el snapshot → cuenta la mitad (ver systemCostForLab).
                const systemCost = labItems.reduce((t: number, i: any) =>
                    t + (i.productCostSnapshot ?? i.product?.cost ?? 0) * (i.eye ? 0.5 : 1) * (i.quantity || 1), 0);
                const numbers = order.labOrderNumber?.match(/\d{4,}/g) || [];

                return {
                    orderId: order.id,
                    clientId: order.clientId,
                    cliente: order.client?.name || '-',
                    fecha: (order.labSentAt || order.createdAt).toISOString(),
                    labOrderNumber: order.labOrderNumber?.trim() || null,
                    numbers,
                    lab,
                    systemCost: Math.round(systemCost),
                    items: labItems.map((i: any) => i.productNameSnapshot || i.product?.name || 'Sin nombre'),
                };
            })
            .filter(Boolean) as any[];

        // Cruce con los costos reales ya registrados (facturas/planillas).
        const allNumbers = rows.flatMap(r => r.numbers);
        const entries = allNumbers.length > 0
            ? await prisma.labCostEntry.findMany({ where: { labOrderNumber: { in: allNumbers } } })
            : [];
        // Clave por (lab, número): la unicidad de LabCostEntry es @@unique([lab,labOrderNumber])
        // y dos labs pueden compartir el mismo número → keyear solo por número colapsaba
        // entradas de labs distintos y cruzaba el pedido contra la factura del lab equivocado.
        const byNumber = new Map(entries.map(e => [`${e.lab}:${e.labOrderNumber}`, e]));

        const report = rows.map(r => {
            const matched = r.numbers.map((n: string) => byNumber.get(`${r.lab}:${n}`)).filter(Boolean);
            // Mismo comparable por laboratorio que upsertEntry: Optovision se compara
            // contra el TOTAL c/IVA (monotributo no lo recupera); el resto contra el neto.
            const billed = matched.length > 0
                ? matched.reduce((t: number, e: any) => t + (r.lab === 'OPTOVISION'
                    ? (e.billedTotal ?? e.billedNet ?? 0)
                    : (e.billedNet ?? e.billedTotal ?? 0)), 0)
                : null;
            const difference = billed !== null ? Math.round(billed - r.systemCost) : null;
            const status = !r.labOrderNumber ? 'SIN_NUMERO'
                : matched.length === 0 ? 'SIN_FACTURA'
                    : difference! > TOLERANCE ? 'OVERCOST'
                        : difference! < -TOLERANCE ? 'UNDERCOST' : 'OK';
            return {
                ...r,
                billed: billed !== null ? Math.round(billed) : null,
                difference,
                invoicesFound: matched.length,
                status,
                // Antigüedad de lo pendiente: días desde el envío al lab sin factura,
                // para detectar operaciones que ya deberían estar facturadas.
                daysWaiting: status === 'SIN_FACTURA' || status === 'SIN_NUMERO'
                    ? Math.max(0, Math.floor((Date.now() - new Date(r.fecha).getTime()) / 86400000))
                    : null,
            };
        });

        const sum = (fn: (r: any) => number) => report.reduce((t, r) => t + fn(r), 0);
        return {
            month: monthLabel,
            rows: report,
            totals: {
                operaciones: report.length,
                costoSistema: sum(r => r.systemCost),
                costoReal: sum(r => r.billed || 0),
                conFactura: report.filter(r => r.invoicesFound > 0).length,
                sinFactura: report.filter(r => r.status === 'SIN_FACTURA').length,
                sinNumero: report.filter(r => r.status === 'SIN_NUMERO').length,
                sobrecostos: report.filter(r => r.status === 'OVERCOST').length,
            },
        };
    }

    /**
     * Re-cruza las entradas que pueden cambiar de estado en una segunda pasada,
     * reutilizando los montos ya guardados:
     *  - UNMATCHED: la factura llegó antes de cargar el nº de pedido en la venta.
     *  - PENDING: ventas multi-pedido (2x1) donde al procesar el 1er pedido el
     *    hermano aún no existía; ahora que están todos, el estado a nivel venta
     *    (OK/OVERCOST/UNDERCOST) queda correcto.
     */
    static async recheckUnmatched() {
        const pendientes = await prisma.labCostEntry.findMany({
            where: { status: { in: ['UNMATCHED', 'PENDING'] } },
        });
        let rematched = 0;
        for (const entry of pendientes) {
            const updated = await this.upsertEntry({
                lab: entry.lab,
                labOrderNumber: entry.labOrderNumber,
                billedNet: entry.billedNet,
                billedTotal: entry.billedTotal,
                source: entry.source as LabCostInput['source'],
                sourceFile: entry.sourceFile,
                invoiceDate: entry.invoiceDate,
                notes: entry.notes,
            });
            if (updated && updated.status !== entry.status) rematched++;
        }
        return { checked: pendientes.length, rematched };
    }

    /** Marca una entrada como ya alertada con su estado actual (dedupe de avisos). */
    static async markAlerted(id: string, status: string) {
        await prisma.labCostEntry.update({
            where: { id },
            data: { alertedAt: new Date(), alertedStatus: status },
        }).catch(err => console.error('[LabCost] Error marcando alerta enviada:', err));
    }

    /**
     * Barrido de ALERTAS INMEDIATAS (pedido del administrador: "cualquier
     * diferencia de costo, y cualquier pedido sin venta ni postventa, avisar
     * enseguida"). Junta todo hallazgo alertable que aún no se avisó — o cuyo
     * estado cambió desde el último aviso (p. ej. un huérfano que al aparecer la
     * venta pasó a OVERCOST) — y manda UN email con el detalle. Corre en el pase
     * rápido (cada 10 min con el sync de SmartLab) y en el cron diario; el par
     * alertedAt/alertedStatus garantiza que nada se avise dos veces ni se escape.
     */
    static async alertNewFindings() {
        const candidatos = await prisma.labCostEntry.findMany({
            where: { status: { in: ['UNMATCHED', 'OVERCOST', 'UNDERCOST'] } },
            include: { order: { select: { id: true, clientId: true, client: { select: { name: true } } } } },
            orderBy: [{ lab: 'asc' }, { createdAt: 'desc' }],
        });
        // Los labs con backfill pendiente no alertan (sus entradas se están
        // estampando en silencio); el resto sigue el dedupe normal.
        const quietPorLab: Record<string, boolean> = {};
        for (const l of this.BACKFILL_LABS) quietPorLab[l] = await this.isQuietLab(l);
        const nuevos = candidatos.filter(e => !quietPorLab[e.lab] && (!e.alertedAt || e.alertedStatus !== e.status));
        if (nuevos.length === 0) return { alerted: 0 };

        // Una venta con varios pedidos (2x1) estampa el estado a NIVEL VENTA en
        // todas sus entradas hermanas: informar UNA fila por venta (la de mayor
        // importe; a igualdad, menor nº) y marcar el resto como alertado junto
        // con ella — el mismo sobrecosto no se lista dos veces.
        const bill = (e: any) => e.lab === 'OPTOVISION' ? (e.billedTotal ?? e.billedNet ?? 0) : (e.billedNet ?? e.billedTotal ?? 0);
        const porVenta = new Map<string, any[]>();
        const findings: any[] = [];
        const suprimidos: any[] = [];
        for (const e of nuevos) {
            if (!e.orderId) { findings.push(e); continue; }
            const key = `${e.lab}:${e.orderId}`;
            if (!porVenta.has(key)) porVenta.set(key, []);
            porVenta.get(key)!.push(e);
        }
        for (const grupo of porVenta.values()) {
            grupo.sort((a, b) => bill(b) - bill(a) || a.labOrderNumber.localeCompare(b.labOrderNumber));
            findings.push(grupo[0]);
            suprimidos.push(...grupo.slice(1));
        }

        // En local/desarrollo no se mandan emails (ruido al administrador con datos
        // de la base local); tampoco se marca alertado, así prod avisa igual.
        if (!this.emailsEnabled()) {
            console.log(`[LabCost] alertNewFindings: ${findings.length} hallazgo(s) (email omitido fuera de producción)`);
            return { alerted: 0, skipped: findings.length };
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const fmt = (n: number | null | undefined) => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
        const LABS: Record<string, string> = { OPTOVISION: 'Optovision', GRUPO_OPTICO: 'Grupo Óptico' };
        const META: Record<string, { label: string; color: string }> = {
            UNMATCHED: { label: 'SIN VENTA NI POSTVENTA', color: '#b91c1c' },
            OVERCOST: { label: 'SOBRECOSTO', color: '#c2410c' },
            UNDERCOST: { label: 'Menor costo (a favor)', color: '#047857' },
        };
        const sinVenta = findings.filter(f => f.status === 'UNMATCHED').length;
        const sobre = findings.filter(f => f.status === 'OVERCOST').length;
        const partes = [
            sinVenta ? `${sinVenta} sin venta` : null,
            sobre ? `${sobre} sobrecosto${sobre > 1 ? 's' : ''}` : null,
            findings.length - sinVenta - sobre ? `${findings.length - sinVenta - sobre} a favor` : null,
        ].filter(Boolean).join(', ');

        const rows = findings.map((f, i) => {
            const m = META[f.status] || { label: f.status, color: '#374151' };
            const cliente = f.order
                ? `<a href="${appUrl}/admin/contactos?clientId=${f.order.clientId}">${f.order.client?.name || 'ver ficha'}</a>`
                : '<span style="color:#b91c1c">—</span>';
            const real = f.lab === 'OPTOVISION' ? (f.billedTotal ?? f.billedNet) : (f.billedNet ?? f.billedTotal);
            return `<tr style="background:${i % 2 ? '#f9fafb' : '#fff'}">
                <td style="padding:6px 8px;border:1px solid #e5e7eb;font-family:monospace">${f.labOrderNumber}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb">${LABS[f.lab] || f.lab}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb">${cliente}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${fmt(f.systemCost)}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${fmt(real)}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;color:${(f.difference ?? 0) > 0 ? '#b91c1c' : '#047857'}">${f.difference != null ? fmt(f.difference) : '—'}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb"><span style="color:${m.color};font-weight:bold">${m.label}</span></td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:12px">${f.notes || '—'}</td>
            </tr>`;
        }).join('');

        const res: any = await sendEmail({
            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
            subject: `🚨 Laboratorio: ${findings.length} hallazgo(s) nuevo(s) — ${partes}`,
            html: `
                <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#1f2937">
                    <h2 style="color:#b91c1c">🚨 Revisión de laboratorio: hallazgos nuevos</h2>
                    <p>El control detectó <strong>${findings.length}</strong> hallazgo(s) que necesitan tu ojo: ${partes}.</p>
                    <table style="border-collapse:collapse;width:100%;font-size:13px">
                        <tr style="background:#111827;color:#fff">
                            <th style="padding:8px;text-align:left">Nº operación</th><th style="padding:8px;text-align:left">Lab</th>
                            <th style="padding:8px;text-align:left">Cliente</th><th style="padding:8px;text-align:right">Costo sistema</th>
                            <th style="padding:8px;text-align:right">Costo real</th><th style="padding:8px;text-align:right">Dif.</th>
                            <th style="padding:8px;text-align:left">Estado</th><th style="padding:8px;text-align:left">Detalle</th>
                        </tr>${rows}
                    </table>
                    <p style="margin-top:14px"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación completa en el CRM</a></p>
                </div>
            `,
        });
        // sendEmail NUNCA lanza: devuelve { success:false } si el envío falló.
        // Marcar como alertado un hallazgo cuyo email no salió lo silenciaría
        // para siempre — solo se marca lo que efectivamente se avisó.
        if (!res?.success) {
            console.error('[LabCost] alertNewFindings: el email NO salió; se reintenta en la próxima corrida.');
            return { alerted: 0, failed: findings.length };
        }
        for (const f of findings) await this.markAlerted(f.id, f.status);
        for (const s of suprimidos) await this.markAlerted(s.id, s.status);
        return { alerted: findings.length };
    }

    /**
     * Aviso en el momento de que llegó una factura de Optovision: de quién es,
     * el monto asignado y si coincide con el costo del sistema (o es más/menos).
     * Contempla 2x1 (si falta el otro par, avisa que la comparación es parcial) y
     * postventa. Es el "informame apenas entra" que pidió el usuario.
     */
    private static async sendInvoiceArrivalAlert(entry: any, order: any, ctx: {
        saleBilled: number | null; systemCost: number | null; status: string;
        difference: number | null; pvCase: any; ventaCompleta: boolean; faltan: number;
    }): Promise<boolean> {
        if (!this.emailsEnabled()) return false;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const fmt = (n: number | null | undefined) => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;
        const cliente = order.client?.name || 'cliente';
        // Mismo criterio que el veredicto (Optovision compara el TOTAL c/IVA):
        // mostrar el neto con veredicto sobre el total daba números que no cierran.
        const propio = fmt(entry.billedTotal ?? entry.billedNet);

        // Veredicto de la comparación (solo si la venta ya tiene todas sus facturas).
        let veredicto: string; let color: string; let emoji: string;
        if (!ctx.ventaCompleta) {
            veredicto = `Comparación parcial: faltan ${ctx.faltan} factura(s) de esta venta (2x1) para el total.`;
            color = '#6b7280'; emoji = '⏳';
        } else if (ctx.status === 'OVERCOST') {
            veredicto = `SOBRECOSTO: el lab cobró ${fmt(ctx.difference)} MÁS que el sistema.`;
            color = '#b91c1c'; emoji = '🚨';
        } else if (ctx.status === 'UNDERCOST') {
            veredicto = `El lab cobró ${fmt(Math.abs(ctx.difference || 0))} MENOS que el sistema.`;
            color = '#059669'; emoji = '✅';
        } else {
            veredicto = 'El costo COINCIDE con el sistema (dentro de tolerancia).';
            color = '#059669'; emoji = '✅';
        }
        const pv = ctx.pvCase ? ` · ⚠️ Corresponde a un caso de POSTVENTA (${ctx.pvCase.caseType || 's/tipo'}${ctx.pvCase.coverage ? `, ${ctx.pvCase.coverage}` : ''}) — un reproceso en garantía debería venir sin cargo.` : '';

        const res: any = await sendEmail({
            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
            subject: `${emoji} Factura Optovision: pedido ${entry.labOrderNumber} — ${cliente} (${propio})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
                    <h2 style="color: ${color};">${emoji} Llegó una factura de Optovision</h2>
                    <p><strong>Pedido ${entry.labOrderNumber}</strong> — <strong>${cliente}</strong></p>
                    <table style="width:100%; border-collapse:collapse; margin:12px 0; font-size:14px;">
                        <tr><td style="padding:8px; border:1px solid #ddd;">Costo facturado (este pedido)</td><td style="padding:8px; border:1px solid #ddd; text-align:right; font-weight:bold;">${propio}</td></tr>
                        ${ctx.ventaCompleta ? `
                        <tr><td style="padding:8px; border:1px solid #ddd;">Total facturado de la venta</td><td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmt(ctx.saleBilled)}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #ddd;">Costo de lista del sistema</td><td style="padding:8px; border:1px solid #ddd; text-align:right;">${fmt(ctx.systemCost)}</td></tr>` : ''}
                    </table>
                    <p style="font-weight:bold; color:${color};">${veredicto}${pv}</p>
                    <p style="font-size:13px; color:#374151;">📦 La factura llega unos <strong>5 días hábiles antes</strong> de que el pedido esté terminado: todavía no está listo, pero está en camino.</p>
                    ${entry.sourceFile ? `<p style="font-size:12px; color:#6b7280;">Factura: ${entry.sourceFile}</p>` : ''}
                    <p style="margin-top:14px;"><a href="${appUrl}/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente</a> · <a href="${appUrl}/admin/laboratorio/costos">Ver conciliación</a></p>
                </div>
            `,
        });
        if (!res?.success) {
            console.error(`[LabCost] Aviso de factura Optovision NO salió (pedido ${entry.labOrderNumber}); se reintenta vía alertNewFindings/próxima corrida.`);
            return false;
        }
        console.log(`[LabCost] Aviso de factura Optovision enviado: pedido ${entry.labOrderNumber} (${propio}, ${entry.status})`);
        return true;
    }

    /**
     * Completa el costo del caso de postventa con lo que facturó el lab, deja
     * nota firmada en el caso y avisa por email al vendedor que cargó el caso
     * (con copia a Ishtar). Reglas: un costo cargado a mano NO se pisa (la nota
     * deja asentada la diferencia), y $0 también informa (garantía sin cargo).
     */
    private static async completePostSaleCost(entry: any, order: any, pvCase: any, billed: number, pedido: string) {
        const costo = Math.round(billed * 100) / 100;
        const labLabel = entry.lab === 'GRUPO_OPTICO' ? 'Grupo Óptico' : 'Optovision';
        const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

        const costoManual = (pvCase.cost ?? 0) > 0;
        const completar = !costoManual && costo > 0;
        if (completar) {
            await prisma.postSaleCase.update({ where: { id: pvCase.id }, data: { cost: costo } });
        }

        const detalleFactura = `${labLabel}, pedido ${pedido}${entry.sourceFile ? `, ${entry.sourceFile}` : ''}`;
        const content = costo > 0
            ? (completar
                ? `Costo del caso completado automáticamente: ${fmt(costo)} según lo facturado por el laboratorio (${detalleFactura}).`
                : `El laboratorio facturó ${fmt(costo)} por el pedido de este caso (${detalleFactura}). El caso ya tenía cargado ${fmt(pvCase.cost)} a mano; se conserva ese valor.`)
            : `El laboratorio facturó el pedido de este caso SIN CARGO (garantía) — ${detalleFactura}.`;
        await prisma.postSaleNote.create({
            data: { caseId: pvCase.id, content, createdBy: 'Sistema' },
        });
        logAudit({
            userName: 'Sistema', action: 'UPDATE', entityType: 'ORDER', entityId: order.id,
            details: { evento: 'costo_postventa', caseId: pvCase.id, pedido, lab: entry.lab, costo, completado: completar },
        }).catch(console.error);

        if (!this.emailsEnabled()) return;
        // Vendedor que cargó el caso: quien hizo el primer movimiento del
        // historial (o la primera nota humana). Si no se resuelve a un usuario
        // con casilla propia, el aviso va a la casilla compartida del local.
        const [hist, primeraNota] = await Promise.all([
            prisma.postSaleStatusHistory.findFirst({
                where: { caseId: pvCase.id }, orderBy: { createdAt: 'asc' }, select: { changedBy: true },
            }),
            prisma.postSaleNote.findFirst({
                where: { caseId: pvCase.id, createdBy: { not: 'Sistema' } },
                orderBy: { createdAt: 'asc' }, select: { createdBy: true },
            }),
        ]);
        const cargadoPor = [hist?.changedBy, primeraNota?.createdBy]
            .find(n => n && n !== 'Sistema') || null;
        const user = cargadoPor
            ? await prisma.user.findFirst({
                where: { name: cargadoPor },
                select: { id: true, name: true, email: true, notificationEmail: true },
            })
            : null;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const res: any = await sendEmail({
            to: notificationEmailFor(user),
            bcc: ISHTAR_INBOX,
            subject: `Costo del caso de postventa de ${order.client?.name || 'cliente'}: ${costo > 0 ? fmt(costo) : 'sin cargo'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                    <p>Hola${cargadoPor ? ` ${firstName(cargadoPor)}` : ''},</p>
                    <p>Ya tenemos el costo del caso de postventa de <strong>${order.client?.name || 'cliente'}</strong> que cargaste:
                    el laboratorio facturó <strong>${costo > 0 ? fmt(costo) : 'sin cargo (garantía)'}</strong> por el pedido
                    <strong style="font-family: monospace;">${pedido}</strong> (${labLabel}).</p>
                    <ul style="line-height: 1.7; font-size: 14px;">
                        <li>Caso: ${pvCase.caseType || 'sin tipo'}${pvCase.coverage ? ` · cobertura: ${pvCase.coverage}` : ''}${pvCase.fault ? ` · falla: ${pvCase.fault}` : ''}</li>
                        <li>${completar
                            ? 'El costo quedó cargado automáticamente en el caso.'
                            : (costoManual
                                ? `El caso ya tenía cargado ${fmt(pvCase.cost)} a mano; se conservó ese valor.`
                                : 'Sin cargo: no había costo que completar.')}</li>
                    </ul>
                    <p><a href="${appUrl}/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente</a></p>
                </div>
            `,
        });
        if (!res?.success) {
            console.error(`[LabCost] Aviso de costo de postventa NO salió (caso ${pvCase.id}, pedido ${pedido}).`);
        } else {
            console.log(`[LabCost] Costo de postventa informado: caso ${pvCase.id}, pedido ${pedido}, ${costo}`);
        }
    }

    private static async sendChargedReworkAlert(entry: any, order: any, pvCase: any, billed: number): Promise<boolean> {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
        const res: any = await sendEmail({
            to: process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com',
            subject: `🚨 Reproceso de POSTVENTA facturado CON CARGO: pedido ${entry.labOrderNumber} (${fmt(billed)})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                    <h2 style="color: #b91c1c;">🚨 Reproceso de postventa con cargo</h2>
                    <p>El pedido <strong style="font-family: monospace;">${entry.labOrderNumber}</strong> nació de un caso de postventa de <strong>${order.client?.name || 'cliente'}</strong> y el laboratorio lo facturó por <strong>${fmt(billed)}</strong>. Los reprocesos en garantía deberían venir sin cargo — verificar con el laboratorio si correspondía garantía o nota de crédito.</p>
                    <ul style="line-height: 1.7; font-size: 14px;">
                        <li>Caso: ${pvCase.caseType || 'sin tipo'}${pvCase.coverage ? ` · cobertura: ${pvCase.coverage}` : ''}${pvCase.fault ? ` · falla: ${pvCase.fault}` : ''}</li>
                        <li>Laboratorio: ${entry.lab === 'GRUPO_OPTICO' ? 'Grupo Óptico' : 'Optovision'}${entry.sourceFile ? ` · ${entry.sourceFile}` : ''}</li>
                    </ul>
                    <p><a href="${appUrl}/admin/contactos?clientId=${order.clientId}">Ver ficha del cliente</a> · <a href="${appUrl}/admin/laboratorio/costos">Ver conciliación</a></p>
                </div>
            `,
        });
        if (!res?.success) {
            console.error(`[LabCost] Alerta de reproceso cobrado NO salió (pedido ${entry.labOrderNumber}); se reintenta en la próxima corrida.`);
            return false;
        }
        console.log(`[LabCost] Alerta de reproceso cobrado enviada: pedido ${entry.labOrderNumber} (${billed})`);
        return true;
    }

    private static async sendOvercostAlert(entry: any, order: any): Promise<boolean> {
        if (!this.emailsEnabled()) return false;
        const billed = entry.lab === 'OPTOVISION'
            ? (entry.billedTotal ?? entry.billedNet ?? 0)
            : (entry.billedNet ?? entry.billedTotal ?? 0);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
        const to = process.env.ADMIN_EMAIL || 'pisano.ishtar@gmail.com';
        const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

        // Ítems cargados en la venta, para distinguir a simple vista si el lab
        // cobró de más o si el vendedor cargó un producto distinto al pedido.
        const itemsHtml = (order.items || [])
            .map((i: any) => {
                const name = i.productNameSnapshot || i.product?.name || 'Producto sin nombre';
                const cost = i.productCostSnapshot ?? i.product?.cost ?? 0;
                return `<li>${name} ×${i.quantity || 1} — costo ${fmt(cost)}</li>`;
            })
            .join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
                <h2 style="color: #dc2626;">⚠️ Diferencia de costo con el laboratorio</h2>
                <p><strong>${entry.lab === 'GRUPO_OPTICO' ? 'Grupo Óptico' : 'Optovision'}</strong> facturó más que el costo de lista cargado en el sistema. Puede ser un sobreprecio del laboratorio <em>o</em> una venta cargada con un producto distinto al que se pidió — revisar la venta:</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Cliente</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${order.client?.name || '-'}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Nº pedido lab</strong></td><td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${entry.labOrderNumber}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Costo sistema (lista)</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: green;">${fmt(entry.systemCost || 0)}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Costo facturado</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">${fmt(billed)}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Diferencia</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;">${fmt(entry.difference || 0)}</td></tr>
                    ${entry.sourceFile ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Factura</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${entry.sourceFile}</td></tr>` : ''}
                </table>
                ${itemsHtml ? `
                <p style="margin-top: 16px; margin-bottom: 4px;"><strong>Cargado en la venta:</strong></p>
                <ul style="margin-top: 0; line-height: 1.6;">${itemsHtml}</ul>
                ` : ''}
                <p style="margin-top: 16px;"><a href="${appUrl}/admin/laboratorio/costos">Ver conciliación de costos en el CRM</a></p>
            </div>
        `;

        const res: any = await sendEmail({
            to,
            subject: `⚠️ Diferencia de costo lab: pedido ${entry.labOrderNumber} (${order.client?.name || 'cliente'})`,
            html,
        });
        if (!res?.success) {
            console.error(`[LabCost] Alerta de sobrecosto NO salió (pedido ${entry.labOrderNumber}); se reintenta vía alertNewFindings.`);
            return false;
        }
        console.log(`[LabCost] Alerta de sobrecosto enviada para pedido ${entry.labOrderNumber}`);
        return true;
    }
}
