import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { Borradores } from '@/services/lab-modules/carga/borrador';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/lab-modulos/borradores/[id]  { accion: 'aprobar' | 'rechazar', motivo? }
 *
 * El OK humano de la carga asistida. Solo desde EN_REVISION (el robot ya llenó
 * el portal y dejó la captura) y solo por una persona identificada: el actor
 * sale del JWT que reinyecta el middleware, nunca del body.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const accion = String(body.accion || '');

        if (accion === 'aprobar') {
            const borrador = await Borradores.aprobar(id, actor);
            return NextResponse.json({ ok: true, borrador });
        }
        if (accion === 'rechazar') {
            const borrador = await Borradores.rechazar(id, actor, String(body.motivo || ''));
            return NextResponse.json({ ok: true, borrador });
        }
        return NextResponse.json({ error: 'La acción tiene que ser "aprobar" o "rechazar".' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo actualizar el borrador.';
        const status = /no existe/.test(msg) ? 404 : /no puede pasar|tiene que hacerla|tiene que hacerlo|Decí por qué/.test(msg) ? 409 : 500;
        if (status === 500) console.error('[lab-modulos/borradores] PATCH:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
