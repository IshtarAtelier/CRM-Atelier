import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { LAB_GRUPO_OPTICO } from './portal';

/**
 * ¿Este par YA tiene pedido en el laboratorio? Cargado por el robot, visto por
 * el seguimiento, o con el nº tipeado en la venta (carga a mano con el
 * favorito). En SmartLab un pedido de más se fabrica y se cobra, y la óptica no
 * lo puede anular: se mira al PREPARAR y otra vez al CARGAR (un par puede
 * cargarse a mano mientras el borrador espera revisión; auditorías del 3/10/2026).
 *
 * Un pedido ANULADO no cuenta. Un nº tipeado en una venta de dos pares que el
 * espejo no ubica en ningún par es AMBIGUO: no se sabe de qué par es, así que
 * no se carga ninguno de los dos hasta que una persona lo aclare.
 */
export interface PedidoExistente { numero: string; ambiguo: boolean }

/** Lo puro de la decisión (lo prueba check:carga-go). */
export function decidirExistente(datos: {
    pair: number;
    pares: number;
    cargadosPorPar: { pair: number; numero: string }[];
    espejo: { numero: string; pair: number | null; anulado: boolean }[];
    numerosEnVenta: string[];
    excluir?: string | null;
}): PedidoExistente | null {
    const anulados = new Set(datos.espejo.filter(e => e.anulado).map(e => e.numero));
    const vivo = (n: string) => !anulados.has(n) && n !== datos.excluir;
    const cargado = datos.cargadosPorPar.find(c => c.pair === datos.pair && vivo(c.numero));
    if (cargado) return { numero: cargado.numero, ambiguo: false };
    const delPar = datos.espejo.find(e => !e.anulado && vivo(e.numero) && (e.pair === datos.pair || (datos.pares === 1 && e.pair === null)));
    if (delPar) return { numero: delPar.numero, ambiguo: false };

    const parDe = new Map<string, number>();
    for (const c of datos.cargadosPorPar) parDe.set(c.numero, c.pair);
    for (const e of datos.espejo) if (e.pair) parDe.set(e.numero, e.pair);
    const nums = datos.numerosEnVenta.filter(vivo);
    if (datos.pares === 1) return nums[0] ? { numero: nums[0], ambiguo: false } : null;
    const deEste = nums.find(n => parDe.get(n) === datos.pair);
    if (deEste) return { numero: deEste, ambiguo: false };
    const sinPar = nums.find(n => !parDe.has(n));
    return sinPar ? { numero: sinPar, ambiguo: true } : null;
}

export async function pedidoExistenteDelPar(orderId: string, pair: number, pares: number, excluir?: string | null): Promise<PedidoExistente | null> {
    const [cargados, espejo, venta] = await Promise.all([
        prisma.labOrderDraft.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO, status: 'CARGADO' }, select: { pair: true, portalNumber: true } }),
        prisma.labPortalOrder.findMany({ where: { orderId, lab: LAB_GRUPO_OPTICO }, select: { portalNumber: true, pair: true, status: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true, postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } } } }),
    ]);
    const deReprocesos = new Set((venta?.postSaleCases || []).flatMap(c => parseLabNumbers(c.newOrderNumber)));
    return decidirExistente({
        pair, pares, excluir,
        cargadosPorPar: cargados.filter(c => c.portalNumber).map(c => ({ pair: c.pair, numero: c.portalNumber! })),
        espejo: espejo.map(e => ({ numero: e.portalNumber, pair: e.pair, anulado: e.status === 'ANULADO' })),
        numerosEnVenta: parseLabNumbers(venta?.labOrderNumber).filter(n => /^80\d{6}$/.test(n) && !deReprocesos.has(n)),
    });
}

export function mensajeExistente(e: PedidoExistente, pair: number): string {
    return e.ambiguo
        ? `La venta tiene el nº ${e.numero} y no se sabe de qué par es (¿se cargó a mano?): no se carga ningún par hasta aclararlo. Revisalo en el portal y dejá en la venta solo los nº que correspondan.`
        : `El par ${pair} ya tiene pedido en el laboratorio (nº ${e.numero}): no se carga otro.`;
}
