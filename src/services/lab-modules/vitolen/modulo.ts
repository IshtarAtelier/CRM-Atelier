import { prisma } from '../../../lib/db';
import { LAB_ITEM_PATTERNS } from '../../lab-recon/types';
import type { EstadoEnPortal, LabModule, OpcionesCorrida, ResultadoSeguimiento } from '../contrato';
import { pedidosAtrasados, reflejar, ventasActivasDelLab, ventasSinPedidoEnPortal } from '../espejo';
import { aplicarEstadoEnVenta } from '../estados';
import { LabCostReconciliationService } from '../../lab-cost-reconciliation.service';
import { conTurno } from '../portal/turno';
import { BASE_VITOLEN, normalizarPedido, periodoDeListado, type FilaListado } from './pedidos';
import { conSesionVitolen, LAB_VITOLEN, leerCuentaCorriente, leerListado, NOMBRE_VITOLEN, pedirBytesDesdeLaPagina, ROBOT_VITOLEN } from './portal';
import { facturasVigentes } from './cuenta-corriente';
import { costoFacturadoDelPedido, parsearFacturasDelPedido, pdfCoincideConCuenta } from './comprobantes';
import { textoPorPagina } from './pdf';

/**
 * EL MÓDULO DE VITOLEN. Seguimiento: una entrada al portal por corrida, el
 * listado entero del período, el espejo y las ventas. Costos: las facturas de
 * cada pedido al cruce (abajo). Carga asistida: vitolen/borrador-portal.ts,
 * desde la ficha de la venta.
 */

const PATRON_VITOLEN = LAB_ITEM_PATTERNS.VITOLEN;

async function seguirPedidos(opts: OpcionesCorrida = {}): Promise<ResultadoSeguimiento> {
    const ahora = new Date();
    const periodo = periodoDeListado(opts.sinceDays);

    const listado = await conSesionVitolen(page => leerListado(page, periodo));
    const pedidos = listado.filas.map(normalizarPedido).filter(p => p.portalNumber);
    if (listado.total !== null && listado.total > pedidos.length) {
        // Nunca se da por entero un listado al que le faltan filas: el paginador
        // dijo más de lo que se leyó. Con un listado parcial, las ventas de las
        // filas que faltan saldrían como "sin pedido en el portal".
        throw new Error(`${NOMBRE_VITOLEN}: el portal dice ${listado.total} pedidos y se leyeron ${pedidos.length} en ${listado.paginasLeidas} página(s).`);
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
    // Los atrasos se miran en el ESPEJO, no solo en el listado de esta lectura:
    // el pase rápido pide 30 días, y el pedido más atrasado es justo el que ya
    // salió de esa ventana.
    const abiertos = await prisma.labPortalOrder.findMany({
        where: { lab: LAB_VITOLEN, status: { in: ['INGRESADO', 'EN_PROCESO'] }, estimatedAt: { not: null } },
        select: { portalNumber: true, cliente: true, status: true, estimatedAt: true },
    });
    return {
        vistos: pedidos.length,
        nuevos,
        cambiados: cambios.length,
        vinculados,
        avanzados,
        terminados,
        sinPedidoEnPortal: ventasSinPedidoEnPortal(ventas, enPortal, ahora),
        atrasados: pedidosAtrasados(abiertos.map(p => ({ portalNumber: p.portalNumber, cliente: p.cliente, status: p.status as EstadoEnPortal, estimatedAt: p.estimatedAt })), ahora),
    };
}

/** Cuántos días hacia atrás mira la diaria de costos (como los 35 de Optovisión, con margen para facturas tardías). */
const VENTANA_COSTOS_DIAS = 90;

/**
 * COSTOS: una entrada al portal; el listado del período, la cuenta corriente
 * (para saber qué facturas anuló una nota de crédito) y, por cada pedido, el
 * PDF con TODAS sus facturas (`facturacion_automatica.pdf?codigo=…`). Cada
 * pedido se registra en el cruce con la suma de sus facturas vigentes; sin
 * facturas queda "esperando factura". Lo dispara la diaria de las 8:30 vía
 * LAB_PROVIDERS, con el turno del portal (no pisa un seguimiento en curso).
 */
async function recolectarCostos(opts: OpcionesCorrida = {}): Promise<Record<string, unknown>> {
    const ahora = new Date();
    const ventana = opts.sinceDays ?? VENTANA_COSTOS_DIAS;
    const periodo = periodoDeListado(ventana);
    // La cuenta corriente se mira con margen: las facturas de un pedido llegan
    // después del pedido, y sirven para saber qué se anuló y para validar el PDF.
    const desdeCuenta = new Date(ahora.getTime() - (ventana + 45) * 86400000);

    const corrida = await conTurno(LAB_VITOLEN, 'completa', async () => conSesionVitolen(async (page) => {
        const listado = await leerListado(page, periodo);
        const cuenta = await leerCuentaCorriente(page, desdeCuenta);
        const vigentes = new Set(facturasVigentes(cuenta.movimientos).map(f => f.comprobante));
        const anuladas = new Set(cuenta.movimientos.filter(m => m.tipo === 'FA' && !vigentes.has(m.comprobante)).map(m => m.comprobante));
        const totalesEnCuenta = new Map(cuenta.movimientos.filter(m => m.tipo === 'FA').map(m => [m.comprobante, m.total ?? m.debe]));

        // Un pedido sin link de factura todavía no está facturado: no es un error.
        // Un PDF que no se pudo bajar o leer sí se anota (invoiceError), y ese
        // pedido no toca importes.
        const pedidos: { fila: FilaListado; paginas: string[] | null; fallo?: string }[] = [];
        for (const fila of listado.filas) {
            if (!fila.pdfFactura) { pedidos.push({ fila, paginas: null }); continue; }
            try {
                const bytes = await pedirBytesDesdeLaPagina(page, fila.pdfFactura);
                pedidos.push({ fila, paginas: await textoPorPagina(bytes) });
            } catch (err: any) {
                pedidos.push({ fila, paginas: null, fallo: err?.message || String(err) });
            }
        }
        return { listado, anuladas, totalesEnCuenta, pedidos };
    }), { esperar: opts.esperarTurno });
    if ('skipped' in corrida) return { skipped: true, reason: corrida.reason };
    const { listado, anuladas, totalesEnCuenta, pedidos } = corrida;

    let conFactura = 0, sinFactura = 0, registrados = 0;
    const invoiceErrors: string[] = [];
    const descartadas: string[] = [];
    for (const p of pedidos) {
        const numero = p.fila.numero.trim();
        if (!numero) continue;
        if (p.fallo) invoiceErrors.push(`${numero}: ${p.fallo}`);
        const facturas = p.paginas ? parsearFacturasDelPedido(p.paginas) : [];
        const costo = costoFacturadoDelPedido(numero, facturas, anuladas, p.fila.pdfFactura ? `${BASE_VITOLEN}${p.fila.pdfFactura}` : null);
        descartadas.push(...costo.descartadas.map(d => `${numero}: ${d}`));
        // Importes solo si el PDF es de fiar (cada factura figura en la cuenta
        // corriente con el mismo total); si no, se completa lo que falte sin
        // pisar lo que otra corrida ya registró.
        const fiable = facturas.length ? pdfCoincideConCuenta(facturas, totalesEnCuenta) : { confiable: true as const };
        if (!fiable.confiable) invoiceErrors.push(`${numero}: ${fiable.motivo}`);
        const tieneImporte = costo.billedTotal !== null;
        if (tieneImporte) conFactura++; else sinFactura++;
        const entrada = await LabCostReconciliationService.upsertEntry({
            lab: LAB_VITOLEN,
            labOrderNumber: numero,
            billedNet: tieneImporte ? costo.billedNet : null,
            billedTotal: tieneImporte ? costo.billedTotal : null,
            preferExistingBilling: !fiable.confiable,
            source: 'SCRAPER',
            sourceFile: p.fila.pdfFactura ? `facturacion_automatica.pdf?codigo=${p.fila.codigoFactura}` : null,
            invoiceDate: costo.invoiceDate ?? undefined,
            invoiceRefs: tieneImporte && fiable.confiable ? costo.invoiceRefs : undefined,
            notes: [
                p.fila.nroCaso ? `Caso: ${p.fila.nroCaso}` : null,
                p.fila.estado ? `Estado en el portal: ${p.fila.estado}` : null,
                facturas.some(f => !f.lineasCompletas) ? 'Alguna línea del PDF no se pudo leer entera (los importes salen de los totales).' : null,
                !fiable.confiable ? `PDF sin validar contra la cuenta corriente (${fiable.motivo}): importes sin actualizar.` : null,
            ].filter(Boolean).join(' · ') || null,
        });
        if (entrada) registrados++;
    }
    // Solo un listado parcial es un error de la pasada (el portal dijo más de lo
    // que se leyó): con él la pasada no se sella como buena.
    const error = listado.total !== null && listado.total > pedidos.length
        ? `el portal dice ${listado.total} pedidos y se leyeron ${pedidos.length}`
        : undefined;
    return {
        pedidos: pedidos.length, registrados, conFactura, sinFactura, anuladas: anuladas.size, descartadas,
        invoiceErrors, invoiceError: invoiceErrors.length ? invoiceErrors.join(' | ') : undefined,
        error,
    };
}

export const MODULO_VITOLEN: LabModule = {
    clave: LAB_VITOLEN,
    nombre: NOMBRE_VITOLEN,
    patronProducto: PATRON_VITOLEN,
    capacidades: { seguimiento: true, costos: true, carga: true },
    cadenciaRapidaMin: 30,
    // Todavía no se sabe cuánto tarda un pedido terminado en llegar al local:
    // el aviso de retiro al cliente lo manda el vendedor, no el cron.
    avisoDeRetiroAutomatico: false,
    seguirPedidos,
    recolectarCostos,
};
