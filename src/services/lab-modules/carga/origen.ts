import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import type { OpcionesExistente } from './existentes';

/**
 * EL Nº DEL PAR CON CARGO de una promo de dos pares, para cualquier laboratorio:
 * en Grupo Óptico va en la observación del par sin cargo ("1° par n° 80…");
 * en Vitolen es el "pedido origen" del 2º par. Es lo que hace que el
 * laboratorio no cobre (o cobre al 20 %) el segundo.
 *
 * Se elige en este orden: el borrador CARGADO de ese par; si no, lo que el
 * seguimiento vinculó a ese par; si no, el único nº de ESTE lab tipeado en la
 * venta. Un pedido ANULADO o un nº de reproceso NUNCA es origen (auditoría 5,
 * 8/10/2026: con el 1er par anulado y recargado, el fallback tomaba el nº
 * anulado). Hasta el 10/10/2026 Vitolen tenía su propia copia sin estas
 * reglas (auditoría de arquitectura, C1). Lo puro se prueba en check:carga-go.
 */
export function elegirNumeroDelParConCargo(datos: {
    cargado: string | null;
    espejo: { numero: string; pair: number | null; anulado: boolean }[];
    numerosEnVenta: string[];
    reprocesos: string[];
    pair: number;
    esNumeroDelLab?: (n: string) => boolean;
}): string | null {
    const anulados = new Set(datos.espejo.filter(e => e.anulado).map(e => e.numero));
    const descartado = new Set([...anulados, ...datos.reprocesos]);
    if (datos.cargado && !descartado.has(datos.cargado)) return datos.cargado;
    const delPar = datos.espejo.filter(e => !e.anulado && e.pair === datos.pair && !descartado.has(e.numero));
    if (delPar.length === 1) return delPar[0].numero;
    if (delPar.length > 1) return null;
    // El nº tipeado solo vale si es de este lab y no es de OTRO par según el espejo.
    const deOtroPar = new Set(datos.espejo.filter(e => e.pair !== null && e.pair !== datos.pair).map(e => e.numero));
    const esDelLab = datos.esNumeroDelLab ?? (() => true);
    const nums = datos.numerosEnVenta.filter(n => esDelLab(n) && !descartado.has(n) && !deOtroPar.has(n));
    return nums.length === 1 ? nums[0] : null;
}

export async function numeroDelParConCargo(lab: string, orderId: string, pair: number, opciones: OpcionesExistente = {}): Promise<string | null> {
    const norm = opciones.normalizar ?? ((n: string) => n);
    const [cargado, espejo, venta] = await Promise.all([
        prisma.labOrderDraft.findFirst({ where: { orderId, lab, pair, status: 'CARGADO' }, orderBy: { loadedAt: 'desc' }, select: { portalNumber: true } }),
        prisma.labPortalOrder.findMany({ where: { orderId, lab }, select: { portalNumber: true, pair: true, status: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true, postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } } } }),
    ]);
    return elegirNumeroDelParConCargo({
        pair,
        cargado: cargado?.portalNumber ? norm(cargado.portalNumber) : null,
        espejo: espejo.map(e => ({ numero: norm(e.portalNumber), pair: e.pair, anulado: e.status === 'ANULADO' })),
        numerosEnVenta: parseLabNumbers(venta?.labOrderNumber).filter(n => (opciones.esNumeroDelLab ? opciones.esNumeroDelLab(n) : true)).map(norm),
        reprocesos: (venta?.postSaleCases || []).flatMap(c => parseLabNumbers(c.newOrderNumber)).map(norm),
    });
}
