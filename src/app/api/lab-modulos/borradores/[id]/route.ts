import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { Borradores } from '@/services/lab-modules/carga/borrador';
import { cancelarBorradorRechazado, confirmarBorradorAprobado } from '@/services/lab-modules/vitolen/borrador-portal';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * PATCH /api/lab-modulos/borradores/[id]  { accion: 'aprobar' | 'rechazar', motivo? }
 *
 * El OK humano de la carga asistida. Solo desde EN_REVISION (el robot ya creó
 * el borrador en el portal y dejó la captura de su resumen) y solo por una
 * persona identificada: el actor sale del JWT que reinyecta el middleware,
 * nunca del body.
 *
 * Aprobar: queda APROBADO y, en la misma llamada, el robot confirma en el
 * portal (CARGADO con el nº de trabajo). Si la confirmación falla, el borrador
 * queda en ERROR con el motivo y la respuesta lo dice.
 * Rechazar: queda RECHAZADO y el robot cancela el borrador en el portal.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const accion = String(body.accion || '');

        if (accion === 'aprobar') {
            await Borradores.aprobar(id, actor);
            try {
                const borrador = await confirmarBorradorAprobado(id);
                return NextResponse.json({ ok: true, borrador });
            } catch (err: any) {
                return NextResponse.json({ error: `Aprobado, pero el robot no pudo confirmar en el portal: ${err?.message || err}`, borradorId: id }, { status: 502 });
            }
        }
        if (accion === 'rechazar') {
            const borrador = await Borradores.rechazar(id, actor, String(body.motivo || ''));
            const portal = await cancelarBorradorRechazado(id);
            return NextResponse.json({ ok: true, borrador, portal });
        }
        return NextResponse.json({ error: 'La acción tiene que ser "aprobar" o "rechazar".' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo actualizar el borrador.';
        const status = /no existe/.test(msg) ? 404 : /no puede pasar|tiene que hacerla|tiene que hacerlo|Decí por qué/.test(msg) ? 409 : 500;
        if (status === 500) console.error('[lab-modulos/borradores] PATCH:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
