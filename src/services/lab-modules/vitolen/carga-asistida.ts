import { prisma } from '../../../lib/db';
import { parseLabNumbers } from '../../../lib/lab-order-numbers';
import { Borradores } from '../carga/borrador';
import type { BorradorParaVista, CampoDePreparacion, CargaAsistida, VistaDeBorrador } from '../carga/contrato';
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
                const variantes = cristal?.variantes ?? [];
                const campos: CampoDePreparacion[] = [
                    ...(variantes.length > 1 ? [{ clave: 'variante', etiqueta: 'Variante', tipo: 'select' as const, opciones: variantes.map(v => ({ value: v, label: v })), obligatorio: true }] : []),
                    { clave: 'forma', etiqueta: 'Forma del armazón (portal)', tipo: 'select', opciones: FORMAS_PORTAL_VITOLEN.map(f => ({ value: f, label: f })), obligatorio: true },
                    { clave: 'ejeDiagonal', etiqueta: 'Eje de la diagonal (0‑180)', tipo: 'numero', obligatorio: true, min: 0, max: 180, ayuda: 'Ángulo de la diagonal mayor del aro, como lo pide el portal (botón "¿Cómo tomar las medidas?")' },
                ];
                return {
                    pair,
                    titulo: cristal?.diseno ?? null,
                    faltantes: r.faltantes.filter(f => !/variante|forma del armazón|eje de la diagonal/.test(f)),
                    avisos: r.avisos,
                    campos,
                };
            }),
        };
    },

    vistaDeBorrador(b: BorradorParaVista): VistaDeBorrador {
        const p = (b.payload || {}) as any;
        const r = (b.resumenPortal || {}) as any;
        const ojo = (g: any) => g ? `${g.esferico > 0 ? '+' : ''}${g.esferico}${g.cilindrico != null ? ` ${g.cilindrico > 0 ? '+' : ''}${g.cilindrico} × ${g.eje ?? '—'}` : ''}${g.adicion != null ? ` add ${g.adicion}` : ''} · DNP ${g.dnp ?? '—'} · alt ${g.altura ?? '—'} · ${g.material} (${g.codigo})` : '—';
        return {
            textoRevision: 'El pedido ya está en el portal de Vitolen como borrador sin confirmar. Aprobar lo confirma, trae el nº de pedido y le avisa al cliente que su pedido fue procesado; Rechazar lo cancela en el portal.',
            filas: [
                { titulo: 'Caso', valor: `${p.nroCasoInterno ?? ''} · ${p.paciente ?? ''}`, fuerte: true },
                { titulo: 'Diseño', valor: `${p.tipoReceta ?? ''} · ${p.diseno ?? ''}${p.variante ? ` ${p.variante}` : ''}` },
                { titulo: 'OD', valor: ojo(p.od) },
                { titulo: 'OI', valor: ojo(p.oi) },
                { titulo: 'Armazón', valor: `${p.armazon?.forma ?? ''} · A ${p.armazon?.largo ?? '—'} B ${p.armazon?.alto ?? '—'} DBL ${p.armazon?.puente ?? '—'} ED ${p.armazon?.diagonalMayor ?? '—'} eje ${p.armazon?.ejeDiagonal ?? '—'}° · ${p.armazon?.caracteristicas ?? ''}` },
                { titulo: 'Trabajos', valor: `${p.tratamientos?.antirreflejo ? 'AR' : 'sin AR'} · ${p.montajes?.calibrado ? 'calibrado' : 'sin calibrar'}${p.pedidoOrigen ? ` · 2º par de ${p.pedidoOrigen}` : ''}` },
            ],
            avisos: Array.isArray(r.pendientes) ? r.pendientes : [],
            tituloAvisos: 'Quedó para hacer a mano en el portal antes de aprobar:',
            enlacePortal: r.url ?? null,
            documento: null,
            pendienteEnPortal: r.portalDraftId && !r.canceladoEl && !r.confirmadoAManoEl && (b.status === 'RECHAZADO' || b.status === 'ERROR') ? { id: String(r.portalDraftId), url: r.url ?? null } : null,
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
            const cargado = await prisma.labOrderDraft.findFirst({ where: { orderId, lab: LAB_VITOLEN, pair: 1, status: 'CARGADO' }, select: { portalNumber: true } });
            if (cargado?.portalNumber) pedidoOrigen = cargado.portalNumber;
            const enEspejo = pedidoOrigen ? null : await prisma.labPortalOrder.findFirst({ where: { orderId, lab: LAB_VITOLEN, pair: { not: 2 } }, orderBy: { enteredAt: 'asc' }, select: { portalNumber: true } });
            const enVenta = await prisma.order.findUnique({ where: { id: orderId }, select: { labOrderNumber: true } });
            pedidoOrigen = pedidoOrigen ?? enEspejo?.portalNumber ?? parseLabNumbers(enVenta?.labOrderNumber).map(n => `${n}L`)[0] ?? null;
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
