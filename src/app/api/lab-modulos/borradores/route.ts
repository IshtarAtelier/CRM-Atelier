import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { Borradores } from '@/services/lab-modules/carga/borrador';
import { armarFormulario, leerVentaParaCarga } from '@/services/lab-modules/vitolen/carga';
import { cristalVitolenPorNombre } from '@/services/lab-modules/vitolen/catalogo';
import { llenarBorradorEnPortal } from '@/services/lab-modules/vitolen/borrador-portal';

export const dynamic = 'force-dynamic';

/**
 * Carga asistida de un pedido en el portal del laboratorio.
 *
 *  GET  /api/lab-modulos/borradores?orderId=…  → borradores de la venta + lo que
 *       el portal muestra de ella (espejo) + qué necesita cada par para armarse.
 *  POST /api/lab-modulos/borradores { orderId, pair, variante?, forma?, ejeDiagonal?, pedidoOrigen? }
 *       → arma el pedido desde la venta; si falta un dato, lo dice y no crea nada;
 *       si está completo, crea el borrador PREPARADO. El robot lo llena en el
 *       portal y lo deja EN_REVISION; una persona lo aprueba (PATCH en [id]).
 *
 * Hoy solo Vitolen tiene carga asistida.
 */
// Las 12 tarjetas "Forma OD - N" del formulario del portal (docs/vitolen-portal.md).
const FORMAS_PORTAL = Array.from({ length: 12 }, (_, i) => `Forma ${i + 1}`);

export async function GET(request: Request) {
    const orderId = new URL(request.url).searchParams.get('orderId') || '';
    if (!orderId) return NextResponse.json({ error: 'Falta orderId.' }, { status: 400 });

    const venta = await leerVentaParaCarga(orderId);
    if (!venta) return NextResponse.json({ error: 'Venta no encontrada.' }, { status: 404 });

    const [borradores, espejo] = await Promise.all([
        Borradores.deVenta(orderId),
        prisma.labPortalOrder.findMany({ where: { orderId }, orderBy: { portalNumber: 'asc' } }),
    ]);

    // Qué pares de Vitolen tiene la venta y qué le falta a cada uno para armarse
    // (sin forma ni variante elegidas todavía: eso lo decide quien prepara).
    const pares = [...new Set(venta.items
        .filter(i => /vitolen/i.test(i.laboratorySnapshot || '') && /cristal/i.test(i.productCategorySnapshot || ''))
        .map(i => i.framePosition ?? 1))].sort();
    const analisis = pares.map(pair => {
        const r = armarFormulario(venta, { pair, forma: 'Forma 1', ejeDiagonal: 0 });
        const cristal = cristalVitolenPorNombre(venta.items.find(i => (i.framePosition ?? 1) === pair && /vitolen/i.test(i.laboratorySnapshot || ''))?.productNameSnapshot);
        return {
            pair,
            diseno: cristal?.diseno ?? null,
            variantes: cristal?.variantes ?? [],
            faltantes: r.faltantes.filter(f => !/variante|forma del armazón/.test(f)),
            avisos: r.avisos,
        };
    });

    return NextResponse.json({ borradores, espejo, pares: analisis, formas: FORMAS_PORTAL });
}

export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const orderId = String(body.orderId || '');
        const pair = body.pair === undefined ? 1 : Number(body.pair);
        if (!orderId) return NextResponse.json({ error: 'Falta orderId.' }, { status: 400 });
        if (!Number.isInteger(pair) || pair < 1 || pair > 2) return NextResponse.json({ error: 'El par tiene que ser 1 o 2.' }, { status: 400 });
        const forma = body.forma ? String(body.forma) : null;
        if (forma && !FORMAS_PORTAL.includes(forma)) return NextResponse.json({ error: 'La forma tiene que ser Forma 1 a Forma 12.' }, { status: 400 });

        const venta = await leerVentaParaCarga(orderId);
        if (!venta) return NextResponse.json({ error: 'Venta no encontrada.' }, { status: 404 });
        // Al laboratorio va solo una venta ENVIADA a fábrica: así queda quién la
        // envió (vendedor = labSentBy), la fecha, y el seguimiento la vincula.
        if (venta.labStatus !== 'SENT') {
            return NextResponse.json({ error: `La venta tiene que estar enviada a fábrica antes de cargarla en el portal (hoy está ${venta.labStatus || 'sin enviar'}).` }, { status: 409 });
        }
        const paresDeLaVenta = new Set(venta.items.filter(i => /vitolen/i.test(i.laboratorySnapshot || '') && /cristal/i.test(i.productCategorySnapshot || '')).map(i => i.framePosition ?? 1));
        if (!paresDeLaVenta.has(pair)) return NextResponse.json({ error: `La venta no tiene cristales de Vitolen para el par ${pair}.` }, { status: 400 });

        const ejeDiagonal = body.ejeDiagonal === undefined || body.ejeDiagonal === null || body.ejeDiagonal === '' ? null : Number(body.ejeDiagonal);
        if (ejeDiagonal !== null && !(Number.isFinite(ejeDiagonal) && ejeDiagonal >= 0 && ejeDiagonal <= 180)) {
            return NextResponse.json({ error: 'El eje de la diagonal mayor va de 0 a 180.' }, { status: 400 });
        }
        const r = armarFormulario(venta, {
            pair, forma, ejeDiagonal,
            variante: body.variante ? String(body.variante) : null,
            pedidoOrigen: body.pedidoOrigen ? String(body.pedidoOrigen) : null,
        });
        if (!r.ok) {
            return NextResponse.json({ error: 'Faltan datos para armar el pedido.', faltantes: r.faltantes, avisos: r.avisos }, { status: 422 });
        }

        const preparado = await Borradores.preparar({ lab: 'VITOLEN', orderId, pair, payload: r.payload, actor });
        // El robot entra al portal, llena, aprieta "Crear" (borrador en el
        // portal) y deja la captura del resumen para revisar. Tarda unos
        // segundos; si falla, el borrador queda en ERROR con el motivo.
        try {
            const borrador = await llenarBorradorEnPortal(preparado.id);
            return NextResponse.json({ ok: true, borrador, avisos: r.avisos });
        } catch (err: any) {
            return NextResponse.json({ error: `El robot no pudo llenar el pedido en el portal: ${err?.message || err}`, borradorId: preparado.id }, { status: 502 });
        }
    } catch (error: any) {
        const msg = error?.message || 'No se pudo preparar el pedido.';
        const status = /Ya hay un borrador|dejó el pedido/.test(msg) ? 409 : 500;
        if (status === 500) console.error('[lab-modulos/borradores] POST:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
