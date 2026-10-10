import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { accionesDe, Borradores } from '@/services/lab-modules/carga/borrador';
import { httpDeError } from '@/services/lab-modules/carga/errores';
import { pedidosEnEspejo } from '@/services/lab-modules/espejo';
import { cargaDe } from '@/services/lab-modules/carga/registro';

export const dynamic = 'force-dynamic';

/**
 * Carga asistida de un pedido en el portal del laboratorio (cualquier lab con
 * CargaAsistida registrada: src/services/lab-modules/carga/registro.ts).
 *
 *  GET  /api/lab-modulos/borradores?orderId=…&lab=GRUPO_OPTICO
 *       → borradores de la venta en ese lab + lo que su portal muestra de ella
 *       (espejo) + qué necesita cada par para armarse.
 *  POST /api/lab-modulos/borradores { orderId, lab, pair, …opciones del lab }
 *       → arma el pedido desde la venta; si falta un dato, lo dice y no crea
 *       nada; si está completo, el robot lo deja PARA REVISAR. Una persona lo
 *       aprueba (PATCH en [id]) y recién ahí el robot carga.
 *
 * Sin `lab` vale Vitolen: es lo que manda la ficha desde el 1/10/2026.
 */
export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const orderId = params.get('orderId') || '';
    if (!orderId) return NextResponse.json({ error: 'Falta orderId.' }, { status: 400 });
    const carga = cargaDe(params.get('lab') || 'VITOLEN');
    if (!carga) return NextResponse.json({ error: 'Ese laboratorio no tiene carga asistida.' }, { status: 400 });

    const analisis = await carga.analizar(orderId);
    if (!analisis) return NextResponse.json({ error: 'Venta no encontrada.' }, { status: 404 });
    const [borradores, espejo] = await Promise.all([
        Borradores.deVenta(orderId).then(bs => bs.filter(b => b.lab === carga.lab)),
        pedidosEnEspejo(carga.lab, orderId),
    ]);
    return NextResponse.json({
        lab: carga.lab, nombre: carga.nombre,
        // Cada borrador con SU vista: la ficha dibuja igual cualquier laboratorio.
        borradores: borradores.map(b => {
            // Un borrador viejo con otra forma de payload no puede tirar abajo la ficha entera.
            const acciones = accionesDe(b, { conBorradorEnPortal: !!carga.cancelarEnPortal, puedeReleer: !!carga.releerPortal }, new Date(), { bloqueadoPorExistente: !!analisis.pares.find(p => p.pair === b.pair)?.yaCargado });
            try { return { ...b, vista: carga.vistaDeBorrador(b), acciones }; } catch (err) {
                console.error('[lab-modulos/borradores] vista del borrador', b.id, err);
                return { ...b, vista: { textoRevision: '', filas: [], avisos: [] }, acciones };
            }
        }),
        espejo, pares: analisis.pares,
        puedeCancelarEnPortal: !!carga.cancelarEnPortal,
    });
}

export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const orderId = String(body.orderId || '');
        const pair = body.pair === undefined ? 1 : Number(body.pair);
        if (!orderId) return NextResponse.json({ error: 'Falta orderId.' }, { status: 400 });
        if (!Number.isInteger(pair) || pair < 1 || pair > 2) return NextResponse.json({ error: 'El par tiene que ser 1 o 2.' }, { status: 400 });
        const carga = cargaDe(body.lab || 'VITOLEN');
        if (!carga) return NextResponse.json({ error: 'Ese laboratorio no tiene carga asistida.' }, { status: 400 });

        const r = await carga.preparar(orderId, pair, body, actor);
        const { status, ok, ...resto } = r;
        return NextResponse.json(ok ? { ok: true, ...resto } : resto, { status });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo preparar el pedido.';
        const status = httpDeError(error);
        if (status === 500) console.error('[lab-modulos/borradores] POST:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
