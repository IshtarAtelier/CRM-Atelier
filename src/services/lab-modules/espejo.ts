import { prisma } from '../../lib/db';
import { parseLabNumbers } from '../../lib/lab-order-numbers';
import type { EstadoEnPortal, PedidoEnPortal } from './contrato';

/**
 * EL ESPEJO: lo que el portal mostró la última vez, pedido por pedido
 * (LabPortalOrder). El módulo lee el portal y llama a `reflejar`; de acá salen
 * los cambios (para mover ventas) y las dos alertas que hoy nadie da:
 * ventas enviadas sin pedido en el portal, y pedidos atrasados.
 */

export interface CambioDePedido {
    portalNumber: string;
    de: EstadoEnPortal | null; // null = nunca visto
    a: EstadoEnPortal;
    orderId: string | null;
}

/** Lo que importa comparar entre dos lecturas. Puro: `npm run check:lab-modulos`. */
export function cambioEnPedido(
    previo: { status: string; estimatedAt: Date | null; finishedAt: Date | null } | null,
    nuevo: PedidoEnPortal,
): boolean {
    if (!previo) return true;
    if (previo.status !== nuevo.status) return true;
    if ((previo.estimatedAt?.getTime() ?? null) !== (nuevo.estimatedAt?.getTime() ?? null)) return true;
    if ((previo.finishedAt?.getTime() ?? null) !== (nuevo.finishedAt?.getTime() ?? null)) return true;
    return false;
}

export interface VentaActiva {
    id: string;
    labOrderNumber: string | null;
    postSaleNumbers: string[];
    clientName: string;
}

/**
 * A qué venta pertenece un pedido del portal. Puro.
 *
 * Tres llaves, en orden de confianza; solo vincula si la llave da UNA venta:
 *  1. el nº de pedido del portal está en `labOrderNumber` (o en un reproceso)
 *     de la venta — es la vinculación de siempre;
 *  2. el "Nro de Caso Interno" es el código corto de la venta (#A1B2, los
 *     últimos 4 del id), que es lo que el vendedor ve en el CRM y carga;
 *  3. el "Nro de Caso Interno" es el nombre del cliente (así carga Grupo
 *     Óptico hoy), entre las ventas activas de este laboratorio.
 * Dos ventas candidatas = no se vincula: mejor sin vínculo que mal vinculado.
 */
export function ventaDelPedido(pedido: PedidoEnPortal, ventas: VentaActiva[]): VentaActiva | null {
    // Se compara dígitos contra dígitos: el nº de Vitolen lleva una L
    // ("6981382L") y el campo de la venta se lee con parseLabNumbers.
    const digitos = parseLabNumbers(pedido.portalNumber);
    const porNumero = digitos.length === 0 ? [] : ventas.filter(v =>
        [...parseLabNumbers(v.labOrderNumber || ''), ...v.postSaleNumbers.flatMap(n => parseLabNumbers(n))]
            .some(n => digitos.includes(n)));
    if (porNumero.length === 1) return porNumero[0];
    if (porNumero.length > 1) return null;

    const ref = String(pedido.internalRef || '').trim();
    if (!ref) return null;

    const codigo = ref.replace(/^#/, '').toUpperCase();
    if (/^[A-Z0-9]{4,8}$/.test(codigo)) {
        const porCodigo = ventas.filter(v => v.id.toUpperCase().endsWith(codigo));
        if (porCodigo.length === 1) return porCodigo[0];
        if (porCodigo.length > 1) return null;
    }

    const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const porNombre = ventas.filter(v => normal(v.clientName) === normal(ref));
    return porNombre.length === 1 ? porNombre[0] : null;
}

/** Ventas de este laboratorio que están en manos del lab (para vincular y para la alerta). */
export async function ventasActivasDelLab(patron: RegExp): Promise<(VentaActiva & { labStatus: string | null; labSentAt: Date | null })[]> {
    const ordenes = await prisma.order.findMany({
        where: { isDeleted: false, orderType: 'SALE', labStatus: { in: ['SENT', 'IN_PROGRESS'] } },
        select: {
            id: true, labOrderNumber: true, labStatus: true, labSentAt: true,
            client: { select: { name: true } },
            items: { select: { laboratorySnapshot: true, product: { select: { laboratory: true, category: true } } } },
            postSaleCases: { where: { orderOption: 'DIFFERENT', newOrderNumber: { not: null } }, select: { newOrderNumber: true } },
        },
    });
    return ordenes
        .filter(o => o.items.some(i => patron.test(i.laboratorySnapshot || i.product?.laboratory || '')))
        .map(o => ({
            id: o.id,
            labOrderNumber: o.labOrderNumber,
            labStatus: o.labStatus,
            labSentAt: o.labSentAt,
            postSaleNumbers: o.postSaleCases.map(c => c.newOrderNumber!).filter(Boolean),
            clientName: o.client?.name || '',
        }));
}

/**
 * Escribe la lectura del portal en el espejo y devuelve qué cambió. La
 * vinculación con la venta se decide acá (ventaDelPedido) y se guarda; una
 * vez vinculado, no se desvincula solo.
 */
export async function reflejar(lab: string, pedidos: PedidoEnPortal[], ventas: VentaActiva[]) {
    const ahora = new Date();
    const previos = await prisma.labPortalOrder.findMany({
        where: { lab, portalNumber: { in: pedidos.map(p => p.portalNumber) } },
        select: { portalNumber: true, status: true, estimatedAt: true, finishedAt: true, orderId: true },
    });
    const previoDe = new Map(previos.map(p => [p.portalNumber, p]));
    const cambios: CambioDePedido[] = [];
    let nuevos = 0, vinculados = 0;

    for (const p of pedidos) {
        const previo = previoDe.get(p.portalNumber) ?? null;
        const venta = previo?.orderId ? null : ventaDelPedido(p, ventas);
        const orderId = previo?.orderId ?? venta?.id ?? null;
        if (!previo?.orderId && venta) vinculados++;
        if (!previo) nuevos++;
        const cambio = cambioEnPedido(previo, p);
        const datos = {
            internalRef: p.internalRef ?? null,
            orderId,
            pair: p.pair ?? null,
            statusRaw: p.statusRaw,
            status: p.status,
            cliente: p.cliente ?? null,
            enteredAt: p.enteredAt ?? null,
            estimatedAt: p.estimatedAt ?? null,
            finishedAt: p.finishedAt ?? null,
            dispatchedAt: p.dispatchedAt ?? null,
            invoices: p.invoices ? (p.invoices as any) : undefined,
            raw: p.raw !== undefined ? (p.raw as any) : undefined,
            lastSeenAt: ahora,
            ...(cambio ? { lastChangeAt: ahora } : {}),
        };
        await prisma.labPortalOrder.upsert({
            where: { lab_portalNumber: { lab, portalNumber: p.portalNumber } },
            update: datos,
            create: { lab, portalNumber: p.portalNumber, ...datos, firstSeenAt: ahora },
        });
        if (cambio) cambios.push({ portalNumber: p.portalNumber, de: (previo?.status as EstadoEnPortal) ?? null, a: p.status, orderId });
    }
    return { cambios, nuevos, vinculados };
}

/**
 * Ventas enviadas a este lab que no aparecen en el portal pasado el plazo de
 * gracia (días corridos). Puro sobre lo que le pasan.
 */
export function ventasSinPedidoEnPortal(
    ventas: (VentaActiva & { labSentAt: Date | null })[],
    orderIdsEnPortal: Set<string>,
    ahora: Date,
    graciaDias = 1,
): { orderId: string; cliente: string; enviadaHace: number }[] {
    return ventas
        .filter(v => !orderIdsEnPortal.has(v.id) && v.labSentAt)
        .map(v => ({ orderId: v.id, cliente: v.clientName, enviadaHace: Math.floor((ahora.getTime() - v.labSentAt!.getTime()) / 86400000) }))
        .filter(v => v.enviadaHace >= graciaDias);
}

/**
 * Pedidos con fecha estimada vencida que no terminaron. Puro.
 *
 * Con ventana: un atraso de más de `ventanaDias` ya no es algo para reclamar
 * hoy, es historia (los dos pedidos de Vitolen de 2024 clavados en
 * "Confirmación" habrían salido en el aviso con 779 días). Misma regla que el
 * cruce de costos: los avisos miran 30 días y lo viejo no se repite.
 */
export const VENTANA_ATRASOS_DIAS = 30;

export function pedidosAtrasados(
    pedidos: { portalNumber: string; cliente: string | null; status: EstadoEnPortal; estimatedAt: Date | null }[],
    ahora: Date,
    ventanaDias = VENTANA_ATRASOS_DIAS,
): { portalNumber: string; cliente: string | null; estimatedAt: Date; diasDeAtraso: number }[] {
    // Un DESCONOCIDO no cuenta: no se afirma "atrasado" sobre un estado que no
    // se entendió (si el portal renombra "Despachado", todo saldría atrasado).
    // El día prometido todavía no es atraso: recién desde el día siguiente.
    return pedidos
        .filter(p => p.estimatedAt && p.estimatedAt < ahora && ['INGRESADO', 'EN_PROCESO'].includes(p.status))
        .map(p => ({
            portalNumber: p.portalNumber, cliente: p.cliente, estimatedAt: p.estimatedAt!,
            diasDeAtraso: Math.floor((ahora.getTime() - p.estimatedAt!.getTime()) / 86400000),
        }))
        .filter(p => p.diasDeAtraso >= 1 && p.diasDeAtraso <= ventanaDias);
}
