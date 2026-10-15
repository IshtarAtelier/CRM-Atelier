import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';

/**
 * ¿Este par YA tiene pedido en el laboratorio? Cargado por el robot, visto por
 * el seguimiento, o con el nº tipeado en la venta (carga a mano). Vale para
 * cualquier laboratorio con carga asistida: en SmartLab un pedido de más se
 * fabrica y se cobra y la óptica no lo puede anular; en Vitolen se confirma un
 * segundo trabajo. Se mira al PREPARAR, en la ficha (deshabilita "Aprobar") y
 * otra vez al CARGAR (un par puede cargarse a mano mientras el borrador espera
 * revisión; auditorías del 3 y 5/10/2026).
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

export interface OpcionesExistente {
    /** Un nº que NO cuenta (el borrador propio en el portal, al confirmar). */
    excluir?: string | null;
    /** Qué nº tipeados en la venta son de ESTE laboratorio (los de otro lab no cuentan). */
    esNumeroDelLab?: (n: string) => boolean;
    /** Cómo se comparan los nº del portal con los tipeados (Vitolen muestra "6981382L" y la venta guarda "6981382"). */
    normalizar?: (n: string) => string;
}

export async function pedidoExistenteDelPar(lab: string, orderId: string, pair: number, pares: number, opciones: OpcionesExistente = {}): Promise<PedidoExistente | null> {
    const norm = opciones.normalizar ?? ((n: string) => n);
    const [cargados, espejo, venta] = await Promise.all([
        prisma.labOrderDraft.findMany({ where: { orderId, lab, status: { in: ['CARGADO', 'RECHAZADO', 'ERROR'] } }, select: { pair: true, portalNumber: true, status: true, resumenPortal: true } }),
        prisma.labPortalOrder.findMany({ where: { orderId, lab }, select: { portalNumber: true, pair: true, status: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true, postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } } } }),
    ]);
    // Los nº de reproceso (post-venta) no son el pedido de ningún par.
    const deReprocesos = new Set((venta?.postSaleCases || []).flatMap(c => parseLabNumbers(c.newOrderNumber)).map(norm));
    return decidirExistente({
        pair, pares,
        excluir: opciones.excluir ? norm(opciones.excluir) : null,
        // CARGADO por el robot, o un borrador rechazado/errado cuyo pedido del portal
        // alguien confirmó a mano (el CRM sabe de qué par era).
        cargadosPorPar: cargados
            .map(c => ({ pair: c.pair, numero: c.status === 'CARGADO' ? c.portalNumber : ((c.resumenPortal as any)?.confirmadoAManoNumero as string | undefined) ?? null }))
            .filter(c => !!c.numero)
            .map(c => ({ pair: c.pair, numero: norm(c.numero!) })),
        espejo: espejo.map(e => ({ numero: norm(e.portalNumber), pair: e.pair, anulado: e.status === 'ANULADO' })),
        numerosEnVenta: parseLabNumbers(venta?.labOrderNumber).filter(n => (opciones.esNumeroDelLab ? opciones.esNumeroDelLab(n) : true)).map(norm).filter(n => !deReprocesos.has(n)),
    });
}

export function mensajeExistente(e: PedidoExistente, pair: number): string {
    return e.ambiguo
        ? `La venta tiene el nº ${e.numero} y no se sabe de qué armazón es (¿se cargó a mano?): no se carga ningún par hasta aclararlo. Para aclararlo: en el portal, agregale al código interno de ese pedido "1°par" o "2°par" (Actualizar pedido) y esperá el seguimiento (media hora), o tipeá en la venta solo el nº del par que ya está cargado.`
        : `El par ${pair} ya tiene pedido en el laboratorio (nº ${e.numero}): no se carga otro.`;
}
