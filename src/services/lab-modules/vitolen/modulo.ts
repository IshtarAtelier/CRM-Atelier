import { prisma } from '../../../lib/db';
import { LAB_ITEM_PATTERNS } from '../../lab-recon/types';
import type { EstadoEnPortal, LabModule, OpcionesCorrida, ResultadoSeguimiento } from '../contrato';
import { pedidosAtrasados, reflejar, ventasActivasDelLab, ventasSinPedidoEnPortal } from '../espejo';
import { aplicarEstadoEnVenta } from '../estados';
import { normalizarPedido, periodoDeListado } from './pedidos';
import { conSesionVitolen, LAB_VITOLEN, leerListado, NOMBRE_VITOLEN, ROBOT_VITOLEN } from './portal';

/**
 * EL MÓDULO DE VITOLEN. Seguimiento: una entrada al portal por corrida, el
 * listado entero del período, el espejo y las ventas. Costos y carga asistida
 * llegan en sus etapas (docs/lab-modulos.md); hasta entonces se declaran
 * apagados y el marco no los dispara.
 */

const PATRON_VITOLEN = LAB_ITEM_PATTERNS.VITOLEN;

async function seguirPedidos(opts: OpcionesCorrida = {}): Promise<ResultadoSeguimiento> {
    const ahora = new Date();
    const periodo = periodoDeListado(opts.sinceDays);

    const listado = await conSesionVitolen(page => leerListado(page, periodo));
    const pedidos = listado.filas.map(normalizarPedido).filter(p => p.portalNumber);
    if (listado.total !== null && listado.total > pedidos.length) {
        // Nunca se da por entero un listado al que le faltan filas: el paginador
        // dijo más de lo que se leyó. Se registra lo leído y se avisa por log.
        console.warn(`[lab-modulos] ${NOMBRE_VITOLEN}: el portal dice ${listado.total} pedidos y se leyeron ${pedidos.length} en ${listado.paginasLeidas} página(s).`);
    }

    const ventas = await ventasActivasDelLab(PATRON_VITOLEN);
    const { cambios, nuevos, vinculados } = await reflejar(LAB_VITOLEN, pedidos, ventas);

    // Se aplica el estado a TODA venta activa con pedidos en el espejo, no solo
    // a las que cambiaron en esta lectura: `aplicarEstadoEnVenta` no hace nada
    // si no hay nada que mover, y así una venta vinculada tarde se pone al día.
    let avanzados = 0, terminados = 0;
    const espejo = await prisma.labPortalOrder.findMany({
        where: { lab: LAB_VITOLEN, orderId: { in: ventas.map(v => v.id) } },
        select: { orderId: true, portalNumber: true, status: true, statusRaw: true },
    });
    const porVenta = new Map<string, { portalNumber: string; status: EstadoEnPortal; statusRaw: string }[]>();
    for (const p of espejo) {
        if (!p.orderId) continue;
        porVenta.set(p.orderId, [...(porVenta.get(p.orderId) ?? []), { portalNumber: p.portalNumber, status: p.status as EstadoEnPortal, statusRaw: p.statusRaw ?? '' }]);
    }
    for (const [orderId, pedidosDeVenta] of porVenta) {
        const venta = ventas.find(v => v.id === orderId);
        const r = await aplicarEstadoEnVenta({ orderId, lab: LAB_VITOLEN, nombreLab: NOMBRE_VITOLEN, robot: ROBOT_VITOLEN, pedidos: pedidosDeVenta });
        if (r.labStatus !== venta?.labStatus) {
            avanzados++;
            if (r.labStatus === 'FINISHED') terminados++;
        }
    }

    const enPortal = new Set(porVenta.keys());
    return {
        vistos: pedidos.length,
        nuevos,
        cambiados: cambios.length,
        vinculados,
        avanzados,
        terminados,
        sinPedidoEnPortal: ventasSinPedidoEnPortal(ventas, enPortal, ahora),
        atrasados: pedidosAtrasados(pedidos.map(p => ({ portalNumber: p.portalNumber, cliente: p.cliente ?? null, status: p.status, estimatedAt: p.estimatedAt ?? null })), ahora),
    };
}

export const MODULO_VITOLEN: LabModule = {
    clave: LAB_VITOLEN,
    nombre: NOMBRE_VITOLEN,
    patronProducto: PATRON_VITOLEN,
    capacidades: { seguimiento: true, costos: false, carga: false },
    cadenciaRapidaMin: 30,
    seguirPedidos,
    recolectarCostos: async () => ({ skipped: true, reason: 'los costos de Vitolen llegan en la etapa 4 (docs/lab-modulos.md)' }),
};
