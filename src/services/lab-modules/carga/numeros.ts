import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';

/**
 * LOS NÚMEROS DE PEDIDO QUE UNA VENTA YA TIENE EN UN LABORATORIO, leídos UNA
 * sola vez y con una sola regla (15/10/2026). Antes había tres lectores
 * (¿este par ya tiene pedido?, ¿cuál es el nº del par con cargo?, ¿qué nº son
 * de OTRO par?) que consultaban las mismas cuatro fuentes con reglas parecidas
 * pero no iguales — la regla "un reproceso nunca es el pedido de un par"
 * (auditoría 4, M5) hubo que escribirla tres veces. Ahora las tres decisiones
 * son funciones PURAS sobre este objeto (`decidirExistente`,
 * `elegirNumeroDelParConCargo`, `numerosDeOtrosPares`).
 *
 * Fuentes: los borradores del lab (CARGADO con su nº; RECHAZADO/ERROR cuyo
 * pedido del portal alguien confirmó a mano; y el nº que el portal devolvió
 * aunque el borrador no llegara a CARGADO), el espejo del portal
 * (`LabPortalOrder`, con su par y si está anulado), el nº tipeado en la venta
 * (solo los de este lab) y los reprocesos de postventa.
 */
export interface NumerosDeLaVenta {
    /** Pedidos que el CRM sabe de qué par son (robot o confirmado a mano). */
    cargadosPorPar: { pair: number; numero: string }[];
    /** El nº que el portal le devolvió a un borrador (esté como esté el borrador): es un pedido real. */
    borradoresConNumero: { pair: number; numero: string }[];
    espejo: { numero: string; pair: number | null; anulado: boolean }[];
    /** Lo tipeado en la venta, de este lab y sin los reprocesos. */
    numerosEnVenta: string[];
    reprocesos: string[];
}

export interface OpcionesDeNumeros {
    /** Qué nº tipeados en la venta son de ESTE laboratorio (los de otro lab no cuentan). */
    esNumeroDelLab?: (n: string) => boolean;
    /** Cómo se comparan los nº del portal con los tipeados (Vitolen muestra "6981382L" y la venta guarda "6981382"). */
    normalizar?: (n: string) => string;
}

export async function numerosDeLaVenta(lab: string, orderId: string, opciones: OpcionesDeNumeros = {}): Promise<NumerosDeLaVenta> {
    const norm = opciones.normalizar ?? ((n: string) => n);
    const esDelLab = opciones.esNumeroDelLab ?? (() => true);
    const [borradores, espejo, venta] = await Promise.all([
        prisma.labOrderDraft.findMany({ where: { orderId, lab }, select: { pair: true, portalNumber: true, status: true, resumenPortal: true } }),
        prisma.labPortalOrder.findMany({ where: { orderId, lab }, select: { portalNumber: true, pair: true, status: true } }),
        prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true, postSaleCases: { where: { newOrderNumber: { not: null } }, select: { newOrderNumber: true } } } }),
    ]);
    const reprocesos = (venta?.postSaleCases || []).flatMap(c => parseLabNumbers(c.newOrderNumber)).map(norm);
    const cargadosPorPar: NumerosDeLaVenta['cargadosPorPar'] = [];
    const borradoresConNumero: NumerosDeLaVenta['borradoresConNumero'] = [];
    for (const b of borradores) {
        const rastro = (b.resumenPortal || {}) as { confirmadoAManoNumero?: string; numeroCreado?: string };
        const cargado = b.status === 'CARGADO' ? b.portalNumber : (b.status === 'RECHAZADO' || b.status === 'ERROR') ? rastro.confirmadoAManoNumero ?? null : null;
        if (cargado) cargadosPorPar.push({ pair: b.pair, numero: norm(cargado) });
        if (rastro.numeroCreado) borradoresConNumero.push({ pair: b.pair, numero: norm(rastro.numeroCreado) });
    }
    return {
        cargadosPorPar,
        borradoresConNumero,
        espejo: espejo.map(e => ({ numero: norm(e.portalNumber), pair: e.pair, anulado: e.status === 'ANULADO' })),
        numerosEnVenta: parseLabNumbers(venta?.labOrderNumber).filter(esDelLab).map(norm).filter(n => !reprocesos.includes(n)),
        reprocesos,
    };
}

/**
 * Los nº que ya son de OTRO par de la venta (o de un reproceso): nunca se
 * adoptan como pedido de ESTE par. Un anulado de otro par también se excluye
 * (más vale excluir de más que adoptar un pedido ajeno). Puro.
 */
export function numerosDeOtrosPares(n: NumerosDeLaVenta, pair: number): Set<string> {
    const set = new Set<string>();
    for (const c of n.cargadosPorPar) if (c.pair !== pair) set.add(c.numero);
    for (const b of n.borradoresConNumero) if (b.pair !== pair) set.add(b.numero);
    for (const e of n.espejo) if (e.pair !== null && e.pair > 0 && e.pair !== pair) set.add(e.numero);
    for (const r of n.reprocesos) set.add(r);
    return set;
}
