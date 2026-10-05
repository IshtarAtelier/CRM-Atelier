import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { PreciosVigentesService } from '@/services/precios-vigentes.service';

export const dynamic = 'force-dynamic';

/** GET: ¿este presupuesto tiene precios viejos? Devuelve la comparación ítem por ítem. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const comparacion = await PreciosVigentesService.comparar(id);
        if (!comparacion) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        return NextResponse.json(comparacion);
    } catch (error) {
        console.error('Error comparando precios del presupuesto:', error);
        return NextResponse.json({ error: 'No se pudo comparar los precios' }, { status: 500 });
    }
}

/**
 * POST { accion: 'actualizar' } re-cotiza con los precios de hoy.
 * POST { accion: 'enviar-cotizado', medio } deja firmado que se envió sin actualizar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request, 'CRM');
        const body = await request.json().catch(() => ({}));

        if (body?.accion === 'enviar-cotizado') {
            await PreciosVigentesService.registrarEnvioConPreciosCotizados(id, actor, String(body?.medio || 'envío'));
            return NextResponse.json({ ok: true });
        }
        const comparacion = await PreciosVigentesService.actualizar(id, actor);
        return NextResponse.json({ ok: true, comparacion });
    } catch (error: any) {
        console.error('Error actualizando precios del presupuesto:', error);
        const mensaje = error?.message || 'No se pudo actualizar los precios';
        const status = mensaje.includes('no encontrado') ? 404 : mensaje.includes('Una venta') ? 400 : 500;
        return NextResponse.json({ error: mensaje }, { status });
    }
}
