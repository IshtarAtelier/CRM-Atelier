import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { prisma } from '../lib/db';
import { OptovisionParserService } from './optovision-parser.service';
import { sendEmail } from '../lib/email';
import { RESOLUCIONES_CONOCIDAS } from './lab-providers/resoluciones';

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
}

// Tolerancia en pesos para diferencias de redondeo entre lista y factura.
const TOLERANCE = 100;

// Qué ítems de la orden pertenecen a cada laboratorio (el resto de la orden
// —armazón, accesorios— no lo factura el lab y no debe entrar en el cruce).
const LAB_ITEM_PATTERNS: Record<string, RegExp> = {
    OPTOVISION: /optovision/i,
    GRUPO_OPTICO: /grupo[\s\-]?[oó]ptico/i,
};

export class LabCostReconciliationService {

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

        return relevant.reduce((total, item) => {
            const cost = item.productCostSnapshot ?? item.product?.cost ?? 0;
            const perEyeHalf = item.eye ? 0.5 : 1;
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

        // Buscar la venta cuyo labOrderNumber contiene ese número (o un caso de
        // postventa que generó un pedido nuevo con ese número).
        const order = await prisma.order.findFirst({
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
                    select: { id: true, newOrderNumber: true, caseType: true, coverage: true, fault: true },
                    orderBy: { createdAt: 'desc' as const },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // ¿El número matcheó por POSTVENTA (reproceso) y no por la venta original?
        const pvCase = order?.postSaleCases?.find((c: any) => c.newOrderNumber?.includes(cleanNumber)) || null;

        const existing = await prisma.labCostEntry.findUnique({
            where: { lab_labOrderNumber: { lab: input.lab, labOrderNumber: cleanNumber } },
        });

        // Una fuente sin importes (p. ej. el barrido del portal) NUNCA debe pisar
        // la facturación ya registrada por otra fuente (planilla, PDF de email).
        const hasNewBilling = input.billedNet != null || input.billedTotal != null;
        const keepExistingBilling = !hasNewBilling && !!existing
            && (existing.billedNet !== null || existing.billedTotal !== null);

        const billedNet = keepExistingBilling ? existing!.billedNet : (input.billedNet ?? null);
        const billedTotal = keepExistingBilling ? existing!.billedTotal : (input.billedTotal ?? null);
        const source = keepExistingBilling ? existing!.source : input.source;
        const sourceFile = keepExistingBilling
            ? existing!.sourceFile
            : (input.sourceFile ?? existing?.sourceFile ?? null);
        const invoiceDate = hasNewBilling
            ? (input.invoiceDate ?? null)
            : (existing?.invoiceDate ?? input.invoiceDate ?? null);

        // Comparable por laboratorio: Optovision discrimina IVA y Atelier es
        // monotributo (no lo recupera) → el costo real es el TOTAL c/IVA.
        // Grupo Óptico factura a consumidor final → neto y total coinciden.
        const billedComparable = input.lab === 'OPTOVISION'
            ? (billedTotal ?? billedNet ?? null)
            : (billedNet ?? billedTotal ?? null);
        const systemCost = order ? this.systemCostForLab(order, input.lab) : null;

        // Una venta puede tener varios pedidos de lab ("580841-580844"): el costo
        // sistema es de TODA la venta, mientras la factura puede ser de un pedido.
        const orderNumbers = order?.labOrderNumber?.match(/\d{4,}/g) || [];
        const multiPedido = orderNumbers.length > 1;

        // UNMATCHED = sin venta en el sistema (¡pedido huérfano si vino del portal!)
        // PENDING   = con venta, pero todavía sin costo facturado para comparar
        let status = 'UNMATCHED';
        let difference: number | null = null;
        if (order && billedComparable === null) {
            status = 'PENDING';
        } else if (order && billedComparable !== null && systemCost !== null) {
            difference = billedComparable - systemCost;
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
        const notes = [resolucionNote, pvNote, baseNotes, multiNote].filter(Boolean).join(' ') || null;

        const data = {
            orderId: order?.id ?? null,
            systemCost,
            billedNet,
            billedTotal,
            difference,
            source,
            sourceFile,
            invoiceDate,
            status,
            notes,
        };

        const entry = existing
            ? await prisma.labCostEntry.update({ where: { id: existing.id }, data })
            : await prisma.labCostEntry.create({
                data: { lab: input.lab, labOrderNumber: cleanNumber, ...data },
            });

        // Alertar solo cuando el sobrecosto es nuevo (entrada nueva o que cambió
        // de estado), para no repetir el mail en cada corrida del cron.
        const isNewOvercost = status === 'OVERCOST' && (!existing || existing.status !== 'OVERCOST');
        if (isNewOvercost && order) {
            await this.sendOvercostAlert(entry, order).catch(err =>
                console.error('[LabCost] Error enviando alerta de sobrecosto:', err)
            );
        }

        // Auditoría de POSTVENTA: un reproceso debería venir sin cargo (garantía;
        // Optovision los factura a ~$0). Si el pedido nació de un caso de postventa
        // y la factura trae plata, alertar apenas aparece el importe.
        const prevBilled = existing ? (existing.billedNet ?? existing.billedTotal ?? null) : null;
        const billedChanged = (billedComparable ?? null) !== prevBilled;
        if (pvCase && order && billedComparable !== null && billedComparable > 5000 && billedChanged) {
            await this.sendChargedReworkAlert(entry, order, pvCase, billedComparable).catch(err =>
                console.error('[LabCost] Error enviando alerta de reproceso cobrado:', err)
            );
        }

        return entry;
    }

    /**
     * Escanea la casilla IMAP buscando facturas PDF de Optovision de los últimos
     * `sinceDays` días y registra cada una en la conciliación.
     */
    static async scanOptovisionInbox(sinceDays = 35) {
        // Cadena de credenciales configuradas: primero la dedicada a IMAP y, si
        // falla, la del SMTP (la misma app password de Gmail sirve para ambos).
        const candidates = [
            { user: process.env.IMAP_USER || process.env.EMAIL_USER, password: process.env.IMAP_PASSWORD },
            { user: process.env.EMAIL_USER, password: process.env.EMAIL_PASS },
        ].filter(c => c.user && c.password);

        if (candidates.length === 0) {
            console.warn('[LabCost] Sin credenciales IMAP/EMAIL configuradas. Se omite el escaneo.');
            return { skipped: true, reason: 'no_imap_password' };
        }

        let connection: any = null;
        let lastError: any = null;
        for (const cred of candidates) {
            try {
                connection = await imaps.connect({
                    imap: {
                        user: cred.user!,
                        password: cred.password!,
                        host: 'imap.gmail.com',
                        port: 993,
                        tls: true,
                        tlsOptions: { rejectUnauthorized: false },
                        authTimeout: 10000,
                    },
                });
                break;
            } catch (err: any) {
                lastError = err;
                console.warn(`[LabCost] IMAP no autenticó con ${cred.user}; probando la siguiente credencial configurada…`);
            }
        }
        if (!connection) throw lastError || new Error('IMAP sin conexión');

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
            }
        } finally {
            connection.end();
        }

        console.log(`[LabCost] Escaneo Optovision: ${JSON.stringify(summary)}`);
        return summary;
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
            include: {
                client: { select: { name: true } },
                items: { include: { product: { select: { name: true, cost: true, laboratory: true, category: true } } } },
            },
            orderBy: { createdAt: 'asc' },
        });

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
        const byNumber = new Map(entries.map(e => [e.labOrderNumber, e]));

        const report = rows.map(r => {
            const matched = r.numbers.map((n: string) => byNumber.get(n)).filter(Boolean);
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
            month: `${year}-${String(month).padStart(2, '0')}`,
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
     * Re-cruza las entradas sin match (p. ej. la factura llegó antes de cargar el
     * nº de pedido en la venta) reutilizando los montos ya guardados.
     */
    static async recheckUnmatched() {
        const unmatched = await prisma.labCostEntry.findMany({ where: { status: 'UNMATCHED' } });
        let rematched = 0;
        for (const entry of unmatched) {
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
            if (updated && updated.status !== 'UNMATCHED') rematched++;
        }
        return { checked: unmatched.length, rematched };
    }

    private static async sendChargedReworkAlert(entry: any, order: any, pvCase: any, billed: number) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar';
        const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
        await sendEmail({
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
        console.log(`[LabCost] Alerta de reproceso cobrado enviada: pedido ${entry.labOrderNumber} (${billed})`);
    }

    private static async sendOvercostAlert(entry: any, order: any) {
        const billed = entry.billedNet ?? entry.billedTotal ?? 0;
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

        await sendEmail({
            to,
            subject: `⚠️ Diferencia de costo lab: pedido ${entry.labOrderNumber} (${order.client?.name || 'cliente'})`,
            html,
        });
        console.log(`[LabCost] Alerta de sobrecosto enviada para pedido ${entry.labOrderNumber}`);
    }
}
