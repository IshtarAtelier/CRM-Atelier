import { numerosDeLaVenta, type OpcionesDeNumeros } from './numeros';

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

/** Opciones del lector único de números (ver carga/numeros.ts) + el nº propio a excluir. */
export interface OpcionesExistente extends OpcionesDeNumeros {
    /** Un nº que NO cuenta (el borrador propio en el portal, al confirmar). */
    excluir?: string | null;
}

export async function pedidoExistenteDelPar(lab: string, orderId: string, pair: number, pares: number, opciones: OpcionesExistente = {}): Promise<PedidoExistente | null> {
    const norm = opciones.normalizar ?? ((n: string) => n);
    const n = await numerosDeLaVenta(lab, orderId, opciones);
    return decidirExistente({
        pair, pares,
        excluir: opciones.excluir ? norm(opciones.excluir) : null,
        cargadosPorPar: n.cargadosPorPar,
        espejo: n.espejo,
        numerosEnVenta: n.numerosEnVenta,
    });
}

/** El remedio para un nº ambiguo cuando el portal tiene seguimiento y código interno (Grupo Óptico, Vitolen). */
export const REMEDIO_AMBIGUO_CON_SEGUIMIENTO = 'Para aclararlo: en el portal, agregale al código interno de ese pedido "1°par" o "2°par" (Actualizar pedido) y esperá el seguimiento (media hora), o tipeá en la venta solo el nº del par que ya está cargado.';

/** `remedio`: qué hacer con un nº ambiguo, según lo que ese laboratorio permite (sin seguimiento ni código interno, el remedio del portal no existe). */
export function mensajeExistente(e: PedidoExistente, pair: number, remedio: string = REMEDIO_AMBIGUO_CON_SEGUIMIENTO): string {
    return e.ambiguo
        ? `La venta tiene el nº ${e.numero} y no se sabe de qué armazón es (¿se cargó a mano?): no se carga ningún par hasta aclararlo. ${remedio}`
        : `El par ${pair} ya tiene pedido en el laboratorio (nº ${e.numero}): no se carga otro.`;
}
