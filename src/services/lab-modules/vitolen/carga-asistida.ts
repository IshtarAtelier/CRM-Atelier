import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { Borradores } from '../carga/borrador';
import type { CargaAsistida } from '../carga/contrato';
import { armarFormulario, leerVentaParaCarga } from './carga';
import { cristalVitolenPorNombre } from './catalogo';
import { cancelarEnPortal, confirmarBorradorAprobado, llenarBorradorEnPortal, ROBOT_ACTOR_VITOLEN } from './borrador-portal';
import { LAB_VITOLEN, NOMBRE_VITOLEN } from './portal';

/**
 * La carga asistida de Vitolen detrás del contrato común (carga/contrato.ts).
 * Es la lógica que hasta el 3/10/2026 vivía dentro de la ruta
 * /api/lab-modulos/borradores, sin cambios de comportamiento.
 */

// Las 12 tarjetas "Forma OD - N" del formulario del portal (docs/vitolen-portal.md).
export const FORMAS_PORTAL_VITOLEN = Array.from({ length: 12 }, (_, i) => `Forma ${i + 1}`);

const esCristalVitolen = (i: { laboratorySnapshot: string | null; productCategorySnapshot: string | null }) =>
    /vitolen/i.test(i.laboratorySnapshot || '') && /cristal/i.test(i.productCategorySnapshot || '');

export const CARGA_VITOLEN: CargaAsistida = {
    lab: LAB_VITOLEN,
    nombre: NOMBRE_VITOLEN,
    robot: ROBOT_ACTOR_VITOLEN,

    async analizar(orderId) {
        const venta = await leerVentaParaCarga(orderId);
        if (!venta) return null;
        // Qué pares de Vitolen tiene la venta y qué le falta a cada uno para armarse
        // (sin forma ni variante elegidas todavía: eso lo decide quien prepara).
        const pares = [...new Set(venta.items.filter(esCristalVitolen).map(i => i.framePosition ?? 1))].sort();
        return {
            pares: pares.map(pair => {
                const r = armarFormulario(venta, { pair, forma: 'Forma 1', ejeDiagonal: 0 });
                const cristal = cristalVitolenPorNombre(venta.items.find(i => (i.framePosition ?? 1) === pair && /vitolen/i.test(i.laboratorySnapshot || ''))?.productNameSnapshot);
                return {
                    pair,
                    diseno: cristal?.diseno ?? null,
                    variantes: cristal?.variantes ?? [],
                    faltantes: r.faltantes.filter(f => !/variante|forma del armazón/.test(f)),
                    avisos: r.avisos,
                };
            }),
            formas: FORMAS_PORTAL_VITOLEN,
        };
    },

    async preparar(orderId, pair, body, actor) {
        const forma = body.forma ? String(body.forma) : null;
        if (forma && !FORMAS_PORTAL_VITOLEN.includes(forma)) return { ok: false, status: 400, error: 'La forma tiene que ser Forma 1 a Forma 12.' };
        const venta = await leerVentaParaCarga(orderId);
        if (!venta) return { ok: false, status: 404, error: 'Venta no encontrada.' };
        // Al laboratorio va solo una venta ENVIADA a fábrica: así queda quién la
        // envió (vendedor = labSentBy), la fecha, y el seguimiento la vincula.
        if (venta.labStatus !== 'SENT') {
            return { ok: false, status: 409, error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` };
        }
        const paresDeLaVenta = new Set(venta.items.filter(esCristalVitolen).map(i => i.framePosition ?? 1));
        if (!paresDeLaVenta.has(pair)) return { ok: false, status: 400, error: `La venta no tiene cristales de Vitolen para el par ${pair}.` };

        const ejeDiagonal = body.ejeDiagonal === undefined || body.ejeDiagonal === null || body.ejeDiagonal === '' ? null : Number(body.ejeDiagonal);
        if (ejeDiagonal !== null && !(Number.isFinite(ejeDiagonal) && ejeDiagonal >= 0 && ejeDiagonal <= 180)) {
            return { ok: false, status: 400, error: 'El eje de la diagonal mayor va de 0 a 180.' };
        }
        // El 2º par lleva el nº del 1º como "pedido origen" de la promo: lo que
        // mandó la ficha o, si no, lo que ya sabe el CRM (espejo del portal o el
        // nº cargado en la venta). Sin él, igual queda como pendiente a mano.
        let pedidoOrigen = body.pedidoOrigen ? String(body.pedidoOrigen) : null;
        if (pair === 2 && !pedidoOrigen) {
            const enEspejo = await prisma.labPortalOrder.findFirst({ where: { orderId, lab: LAB_VITOLEN, pair: { not: 2 } }, orderBy: { enteredAt: 'asc' }, select: { portalNumber: true } });
            const enVenta = await prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true } });
            pedidoOrigen = enEspejo?.portalNumber ?? parseLabNumbers(enVenta?.labOrderNumber).map(n => `${n}L`)[0] ?? null;
        }
        const r = armarFormulario(venta, { pair, forma, ejeDiagonal, variante: body.variante ? String(body.variante) : null, pedidoOrigen });
        if (!r.ok) return { ok: false, status: 422, error: 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos };

        const preparado = await Borradores.preparar({ lab: LAB_VITOLEN, orderId, pair, payload: r.payload, actor });
        // El robot entra al portal, llena, aprieta "Crear" (borrador en el
        // portal) y deja la captura del resumen para revisar. Tarda unos
        // segundos; si falla, el borrador queda en ERROR con el motivo.
        try {
            const borrador = await llenarBorradorEnPortal(preparado.id);
            return { ok: true, status: 200, borrador, avisos: r.avisos };
        } catch (err: any) {
            return { ok: false, status: 502, error: `El robot no pudo llenar el pedido en el portal: ${err?.message || err}`, borradorId: preparado.id };
        }
    },

    confirmar: confirmarBorradorAprobado,
    despuesDeRechazar: cancelarEnPortal,
    cancelarEnPortal,
};
