import { prisma } from '../../lib/db';
import { LAB_ITEM_PATTERNS, TOLERANCE } from './types';

/**
 * REPORTES y LIBRO DE AUDITORÍA de la conciliación: la foto del estado del
 * cruce (cuántos con venta, con postventa, sin venta, esperando factura) y los
 * informes semanal / mensual / por búsqueda que consume la pantalla del CRM.
 *
 * Es el módulo de solo lectura: no muta estados ni manda emails.
 */

/**
 * Snapshot del estado del cruce en este momento: cuántos pedidos se
 * corresponden con ventas, con postventa, y cuántos quedaron sin
 * correspondencia. Base del registro de auditoría diario.
 */
export async function reconciliationSnapshot() {
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
export async function recordAuditRun(opts: {
    trigger?: string;
    providerResults: Record<string, any>;
    staleSources?: string[];
    nuevosSinVenta?: number;
}) {
    const snap = await reconciliationSnapshot();
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
export async function weeklyReport(from: Date, to: Date) {
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
const REPORT_INCLUDE = {
    client: { select: { name: true } },
    items: { include: { product: { select: { name: true, cost: true, laboratory: true, category: true } } } },
} as const;


export async function monthlyReport(year: number, month: number) {
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
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'asc' },
    });

    return assembleReport(orders, `${year}-${String(month).padStart(2, '0')}`);
}


/**
 * Igual que el reporte mensual pero SIN acotar al mes: busca en todo el
 * histórico por nombre de cliente o nº de pedido, y/o por un día puntual.
 * Devuelve el mismo shape (month: 'historico') para reusar la misma tabla.
 */
export async function searchReport(query?: string, day?: string) {
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
    if (conds.length === 0) return assembleReport([], 'historico');

    const orders = await prisma.order.findMany({
        where: { isDeleted: false, orderType: 'SALE', AND: conds },
        include: REPORT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 1000,
    });

    return assembleReport(orders, 'historico');
}


/** Arma el reporte (filas + cruce con facturas + totales) a partir de un set de órdenes ya traído. */
export async function assembleReport(orders: any[], monthLabel: string) {
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

