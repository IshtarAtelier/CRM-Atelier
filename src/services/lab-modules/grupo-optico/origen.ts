import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { LAB_GRUPO_OPTICO } from './portal';
import { esNumeroSmartLab } from './existentes';

/**
 * El nº del par CON CARGO de un 2x1, que va en la observación del par sin
 * cargo ("1° par n° 80…"): es lo que hace que Grupo Óptico no cobre el 2º.
 * Se elige en este orden: el borrador CARGADO de ese par; si no, lo que el
 * seguimiento vinculó a ese par; si no, el único nº de SmartLab tipeado en la
 * venta. Un pedido ANULADO o un nº de reproceso NUNCA es origen (auditoría 5,
 * 8/10/2026: con el 1er par anulado y recargado, el fallback tomaba el nº
 * anulado y el par sin cargo salía atado a un pedido que no existe). Puro.
 */
export function elegirNumeroDelParConCargo(datos: {
    cargado: string | null;
    espejo: { numero: string; pair: number | null; anulado: boolean }[];
    numerosEnVenta: string[];
    reprocesos: string[];
    pair: number;
}): string | null {
    const anulados = new Set(datos.espejo.filter(e => e.anulado).map(e => e.numero));
    const descartado = new Set([...anulados, ...datos.reprocesos]);
    if (datos.cargado && !descartado.has(datos.cargado)) return datos.cargado;
    const delPar = datos.espejo.filter(e => !e.anulado && e.pair === datos.pair && !descartado.has(e.numero));
    if (delPar.length === 1) return delPar[0].numero;
    if (delPar.length > 1) return null;
    // El nº tipeado solo vale si no es de OTRO par según el espejo.
    const deOtroPar = new Set(datos.espejo.filter(e => e.pair !== null && e.pair !== datos.pair).map(e => e.numero));
    const nums = datos.numerosEnVenta.filter(n => esNumeroSmartLab(n) && !descartado.has(n) && !deOtroPar.has(n));
    return nums.length === 1 ? nums[0] : null;
}

export async function numeroDelParConCargo(orderId: string, pair: number): Promise<string | null> {
    const [cargado, espejo, venta] = await Promise.all([
        prisma.labOrderDraft.findFirst({ where: { orderId, lab: LAB_GRUPO_OPTICO, pair, status: 'CARGADO' }, orderBy: { loadedAt: 'desc' }, select: { portalNumber: true } }),
        prisma.labPortalOrder.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO }, select: { portalNumber: true, pair: true, status: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true, postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } } } }),
    ]);
    return elegirNumeroDelParConCargo({
        pair,
        cargado: cargado?.portalNumber ?? null,
        espejo: espejo.map(e => ({ numero: e.portalNumber, pair: e.pair, anulado: e.status === 'ANULADO' })),
        numerosEnVenta: parseLabNumbers(venta?.labOrderNumber),
        reprocesos: (venta?.postSaleCases || []).flatMap(c => parseLabNumbers(c.newOrderNumber)),
    });
}
