import { prisma } from '../../lib/db';
import { LAB_ITEM_PATTERNS, TOLERANCE, VENTANA_REPORTE_DIAS } from './types';
import { esVenta2x1, parBonificadoCobrado, systemCostForLab } from './cost-matching';
import { estaResuelta } from '../../lib/lab-factura';

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
    const esPostventa = (e: any) => (e.notes || '').includes('POSTVENTA (caso');
    const enSemana = (e: any) => !!e.invoiceDate && e.invoiceDate >= from && e.invoiceDate < to;
    // A PARTIR DE AHORA, NO LO DE MESES ATRÁS (Ishtar, 25/9/2026): el estado
    // global y los sobrecostos vigentes miran solo la ventana (30 días) y lo
    // que no se resolvió a mano. Lo viejo se resuelve en la pantalla, no se
    // repite en cada mail.
    const ventanaDesde = new Date(to.getTime() - VENTANA_REPORTE_DIAS * 86400000);
    const fechaRef = (e: any): Date => e.invoiceDate ?? e.createdAt;
    const enVentana = (e: any) => fechaRef(e) >= ventanaDesde && fechaRef(e) < to;
    const abierta = (e: any) => !estaResuelta(e);

    // ¿QUÉ VENTAS SON 2x1? Se mira en los ítems de la venta con la MISMA regla
    // del cruce (esVenta2x1), solo para las ventas que van a salir en el email.
    // El 2x1 tiene que decirse en el reporte: el costo de sistema de la venta
    // cuenta UN par (el bonificado va en $0) y repetirlo en cada fila sin
    // aclararlo se leía como "cada par cuesta eso" (Ishtar, 8/9 y 25/9/2026).
    const idsDeInteres = [...new Set(entries
        .filter(e => e.orderId && (enSemana(e) || e.status === 'OVERCOST'))
        .map(e => e.orderId as string))];
    const ventas = idsDeInteres.length
        ? await prisma.order.findMany({
            where: { id: { in: idsDeInteres } },
            select: {
                id: true, appliedPromoName: true,
                items: { select: { price: true, productCategorySnapshot: true, product: { select: { category: true } } } },
            },
        }).catch(() => [] as any[])
        : [];
    const es2x1De = new Map(ventas.map((v: any) => [v.id, esVenta2x1(v)]));

    // Los pedidos de la MISMA venta en el mismo lab (sin los reprocesos de
    // postventa, que son un hallazgo aparte), estén o no en la semana.
    const porVenta = new Map<string, any[]>();
    for (const e of entries) {
        if (!e.orderId || esPostventa(e)) continue;
        const k = `${e.lab}:${e.orderId}`;
        if (!porVenta.has(k)) porVenta.set(k, []);
        porVenta.get(k)!.push(e);
    }
    const hermanosDe = (e: any) => (e.orderId && !esPostventa(e) ? porVenta.get(`${e.lab}:${e.orderId}`) : null) || [e];
    /**
     * Veredicto del 2x1 a nivel venta: si es 2x1, si ya están facturados todos
     * sus pedidos y si el par bonificado vino cobrado (regla del tope, la misma
     * que aplica el cruce al guardar).
     */
    const veredicto2x1 = (e: any) => {
        const hermanos = hermanosDe(e);
        const importes = hermanos.map(billedOf).filter((n: number | null) => n !== null) as number[];
        const es2x1 = !!e.orderId && es2x1De.get(e.orderId) === true;
        const completa = hermanos.length >= 2 && importes.length === hermanos.length;
        const par = es2x1 && completa ? parBonificadoCobrado(importes) : { cobrado: false, masBarato: null };
        return { es2x1, hermanos, completa, par };
    };

    const perLab: Record<string, any> = {};
    for (const lab of ['OPTOVISION', 'GRUPO_OPTICO']) {
        const rows = entries.filter(e => e.lab === lab);
        const nuevasSemana = rows.filter(enSemana);
        const facturadoSemana = nuevasSemana.reduce((t, e) => t + (billedOf(e) || 0), 0);
        const recientes = rows.filter(enVentana);
        const count = (s: string) => recientes.filter(e => e.status === s && abierta(e)).length;

        // FILAS AGRUPADAS POR VENTA. Los pedidos de un 2x1 van pegados, el par
        // cobrado primero: el costo de sistema y la diferencia son de la VENTA
        // y se muestran una sola vez (misma regla que la pantalla y el aviso
        // diario). Los grupos quedan ordenados por la factura más nueva.
        const grupos = new Map<string, any[]>();
        for (const e of [...nuevasSemana].sort((a, b) => b.invoiceDate!.getTime() - a.invoiceDate!.getTime())) {
            const k = e.orderId && !esPostventa(e) ? `v:${e.orderId}` : `e:${e.id}`;
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k)!.push(e);
        }
        const detalleSemana = [...grupos.values()].flatMap(grupo => {
            grupo.sort((a, b) => (billedOf(b) || 0) - (billedOf(a) || 0) || a.labOrderNumber.localeCompare(b.labOrderNumber));
            const v = veredicto2x1(grupo[0]);
            const enElGrupo = new Set(grupo.map(g => g.id));
            return grupo.map((e, i) => ({
                labOrderNumber: e.labOrderNumber,
                // El email reclama con nº de operación + comprobante + fecha:
                // las tres viajan siempre, en todas las filas.
                sourceFile: e.sourceFile,
                invoiceDate: e.invoiceDate,
                createdAt: e.createdAt,
                cliente: e.order?.client?.name || (e.status === 'UNMATCHED' ? 'SIN VENTA' : '—'),
                clientId: e.order?.clientId || null,
                billed: billedOf(e),
                systemCost: e.systemCost,
                difference: e.difference,
                status: e.status,
                esPostventa: esPostventa(e),
                resuelta: estaResuelta(e),
                resolvedBy: e.resolvedBy ?? null,
                resolvedNote: e.resolvedNote ?? null,
                // De la VENTA (con valor en todas las filas; se muestra en la primera).
                primeraDeLaVenta: i === 0,
                pedidosDeLaVenta: v.hermanos.length,
                es2x1: v.es2x1,
                parBonificadoCobrado: v.par.cobrado,
                parMasBarato: v.par.masBarato,
                // ¿Se pudo verificar el par bonificado? Recién con los dos pedidos facturados.
                parBonificadoVerificado: v.es2x1 && v.completa,
                // Hermanos que NO salen en esta tabla (facturados otra semana o
                // todavía sin factura): se nombran para que la fila no quede coja.
                otrosPedidos: v.hermanos
                    .filter((h: any) => !enElGrupo.has(h.id))
                    .map((h: any) => ({ labOrderNumber: h.labOrderNumber, billed: billedOf(h), invoiceDate: h.invoiceDate })),
            }));
        });

        perLab[lab] = {
            totalPedidos: rows.length,
            facturasSemana: nuevasSemana.length,
            facturadoSemana,
            ventanaDias: VENTANA_REPORTE_DIAS,
            sinVenta: count('UNMATCHED'),
            esperandoFactura: count('PENDING'),
            ok: count('OK'),
            sobrecostos: count('OVERCOST'),
            menorCosto: count('UNDERCOST'),
            resueltos: recientes.filter(e => !abierta(e)).length,
            // Cuenta corriente / facturado acumulado por lab (todo lo que tiene importe).
            facturadoAcumulado: rows.reduce((t, e) => t + (billedOf(e) || 0), 0),
            // Detalle de las facturas de la semana (para la tabla del email).
            detalleSemana,
        };
    }

    // Sobrecostos vigentes (para destacar arriba, sobre todo Optovision).
    // UNO POR VENTA: el estado se estampa en todas las entradas hermanas y un
    // 2x1 con sobrecosto aparecía dos veces, como si fueran dos reclamos.
    const vistos = new Set<string>();
    const unaPorVenta = (e: any) => {
        const k = e.orderId && !esPostventa(e) ? `${e.lab}:${e.orderId}` : e.id;
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
    };
    const sobrecostosAbiertos = entries
        .filter(e => e.status === 'OVERCOST' && abierta(e))
        .sort((a, b) => (b.difference || 0) - (a.difference || 0) || (billedOf(b) || 0) - (billedOf(a) || 0))
        .filter(unaPorVenta);
    // Los de más de 30 días sin resolver no se repiten en el mail: se cuentan,
    // para que se sepa que están, y se resuelven en la pantalla.
    const sobrecostosFueraDeVentana = sobrecostosAbiertos.filter(e => !enVentana(e)).length;
    const sobrecostosVigentes = sobrecostosAbiertos
        .filter(enVentana)
        .map(e => {
            const v = veredicto2x1(e);
            return {
                lab: e.lab, labOrderNumber: e.labOrderNumber, cliente: e.order?.client?.name || '—',
                difference: e.difference, sourceFile: e.sourceFile, invoiceDate: e.invoiceDate, createdAt: e.createdAt,
                es2x1: v.es2x1,
                pedidos: v.hermanos.map((h: any) => h.labOrderNumber),
                parBonificadoCobrado: v.par.cobrado,
                parMasBarato: v.par.masBarato,
            };
        });

    // Cuenta corriente (deuda) por lab según el último resumen recibido.
    const statements = await prisma.labAccountStatement.findMany({
        orderBy: { statementDate: 'desc' }, distinct: ['lab'],
    });
    const cuentaCorriente = statements.map(s => ({
        lab: s.lab, totalDebt: s.totalDebt, statementDate: s.statementDate, invoiceCount: s.invoiceCount,
    }));

    return { from, to, perLab, sobrecostosVigentes, sobrecostosFueraDeVentana, ventanaDias: VENTANA_REPORTE_DIAS, cuentaCorriente };
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
            // El costo de sistema sale de la REGLA ÚNICA del cruce (medio par,
            // cantidad y el par bonificado del 2x1 en $0). Esta pantalla tenía
            // su propia suma, que contaba los DOS pares de un 2x1: mostraba el
            // doble de costo y un "menor costo" fantasma de un par entero.
            const systemCost = systemCostForLab(order, lab);
            const es2x1 = esVenta2x1(order);
            const numbers = order.labOrderNumber?.match(/\d{4,}/g) || [];

            return {
                orderId: order.id,
                clientId: order.clientId,
                cliente: order.client?.name || '-',
                fecha: (order.labSentAt || order.createdAt).toISOString(),
                labOrderNumber: order.labOrderNumber?.trim() || null,
                numbers,
                lab,
                es2x1,
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

    // UNA FILA POR PEDIDO, no por venta (pedido del administrador el 22/7).
    // En un 2x1 la venta tiene DOS operaciones y sumarlas escondía la verdad: si
    // llegó solo la factura del par gratis ($20) y falta la del par caro, la suma
    // se leía como "el lab cobró $1.283.754 menos" — un ahorro que no existe.
    // Separadas se ve lo que pasa de verdad: una facturada y la otra pendiente.
    // El COSTO REAL es exacto por pedido (cada uno tiene su propia factura). El
    // COSTO SISTEMA y la DIFERENCIA son de la VENTA (los cristales se cargan por
    // par y el lab no dice qué par fue a qué operación), así que se muestran una
    // sola vez, en la primera fila del grupo, y la diferencia solo cuando ya
    // están TODAS las facturas de esa venta.
    const report = rows.flatMap(r => {
        const pedidos: string[] = r.numbers.length > 0 ? r.numbers : [];
        const matched = pedidos.map((n: string) => byNumber.get(`${r.lab}:${n}`)).filter(Boolean);
        const billedDe = (e: any) => r.lab === 'OPTOVISION'
            ? (e.billedTotal ?? e.billedNet ?? null)
            : (e.billedNet ?? e.billedTotal ?? null);

        const saleBilled = matched.length > 0
            ? matched.reduce((t: number, e: any) => t + (billedDe(e) ?? 0), 0)
            : null;
        const ventaCompleta = pedidos.length > 0 && matched.length >= pedidos.length;
        // La diferencia solo tiene sentido con la venta entera facturada.
        const difference = ventaCompleta && saleBilled !== null
            ? Math.round(saleBilled - r.systemCost)
            : null;
        // 2x1: uno de los pedidos tiene que venir sin cargo (tope). Si todos
        // vinieron con cargo es SOBRECOSTO aunque la suma cierre — misma regla
        // que aplica el cruce al guardar (parBonificadoCobrado).
        const par = r.es2x1 && ventaCompleta
            ? parBonificadoCobrado(matched.map((e: any) => billedDe(e)).filter((n: number | null) => n !== null) as number[])
            : { cobrado: false, masBarato: null };
        const saleStatus = !r.labOrderNumber ? 'SIN_NUMERO'
            : matched.length === 0 ? 'SIN_FACTURA'
                : !ventaCompleta ? 'PARCIAL'
                    : par.cobrado || difference! > TOLERANCE ? 'OVERCOST'
                        : difference! < -TOLERANCE ? 'UNDERCOST' : 'OK';
        const dias = Math.max(0, Math.floor((Date.now() - new Date(r.fecha).getTime()) / 86400000));

        const base = {
            ...r,
            multiPedido: pedidos.length > 1,
            ventaPedidos: pedidos,
            ventaCompleta,
            saleBilled: saleBilled !== null ? Math.round(saleBilled) : null,
            difference,
            parBonificadoCobrado: par.cobrado,
            parMasBarato: par.masBarato,
            status: saleStatus,
            invoicesFound: matched.length,
            daysWaiting: saleStatus === 'SIN_FACTURA' || saleStatus === 'SIN_NUMERO' || saleStatus === 'PARCIAL' ? dias : null,
        };

        // Venta sin número de operación: una sola fila, no hay nada que desglosar.
        if (pedidos.length === 0) {
            return [{ ...base, pedido: null, billed: null, pedidoFacturado: false, primeraDeLaVenta: true }];
        }

        return pedidos.map((n: string, i: number) => {
            const e: any = byNumber.get(`${r.lab}:${n}`);
            const propio = e ? billedDe(e) : null;
            return {
                ...base,
                // Cada fila es UN pedido con SU costo real.
                pedido: n,
                labOrderNumber: n,
                billed: propio !== null ? Math.round(propio) : null,
                pedidoFacturado: propio !== null,
                // El costo de sistema y la diferencia son de la venta: se muestran
                // una sola vez para no dar a entender que se suman.
                primeraDeLaVenta: i === 0,
                systemCost: i === 0 ? r.systemCost : null,
            };
        });
    });

    // Los totales se cuentan por VENTA (una fila por venta), no por fila del
    // desglose: si no, un 2x1 contaría su costo de sistema dos veces.
    const ventas = report.filter((r: any) => r.primeraDeLaVenta);
    const sumVentas = (fn: (r: any) => number) => ventas.reduce((t, r) => t + fn(r), 0);
    return {
        month: monthLabel,
        rows: report,
        totals: {
            operaciones: ventas.length,
            costoSistema: sumVentas(r => r.systemCost || 0),
            costoReal: sumVentas(r => r.saleBilled || 0),
            conFactura: ventas.filter(r => r.invoicesFound > 0).length,
            sinFactura: ventas.filter(r => r.status === 'SIN_FACTURA').length,
            parciales: ventas.filter(r => r.status === 'PARCIAL').length,
            sinNumero: ventas.filter(r => r.status === 'SIN_NUMERO').length,
            sobrecostos: ventas.filter(r => r.status === 'OVERCOST').length,
        },
    };
}

