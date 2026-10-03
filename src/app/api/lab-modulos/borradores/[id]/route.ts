import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { Borradores } from '@/services/lab-modules/carga/borrador';
import { cancelarEnPortal, confirmarBorradorAprobado } from '@/services/lab-modules/vitolen/borrador-portal';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * PATCH /api/lab-modulos/borradores/[id]  { accion, motivo? }
 *
 * El OK humano de la carga asistida. El actor sale del JWT que reinyecta el
 * middleware, nunca del body.
 *  · aprobar (EN_REVISION): queda APROBADO y, en la misma llamada, el robot
 *    confirma en el portal (CARGADO con el nº de trabajo). Aprobar también
 *    manda al cliente el aviso de "pedido procesado", como cuando se tipea el
 *    nº a mano. Si la confirmación falla, queda APROBADO con el motivo.
 *  · reintentar (APROBADO con falla): el robot vuelve a confirmar.
 *  · rechazar (EN_REVISION): queda RECHAZADO y el robot cancela en el portal.
 *  · cancelar-portal (RECHAZADO / ERROR con pedido en el portal): el robot
 *    cancela ese pedido; recién ahí se puede preparar otro.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const accion = String(body.accion || '');

        if (accion === 'aprobar' || accion === 'reintentar') {
            if (accion === 'aprobar') await Borradores.aprobar(id, actor);
            try {
                const borrador = await confirmarBorradorAprobado(id);
                return NextResponse.json({ ok: true, borrador });
            } catch (err: any) {
                return NextResponse.json({ error: `${accion === 'aprobar' ? 'Aprobado, pero' : 'Todavía'} no se pudo confirmar en el portal: ${err?.message || err}`, borradorId: id }, { status: 502 });
            }
        }
        if (accion === 'rechazar') {
            const borrador = await Borradores.rechazar(id, actor, String(body.motivo || ''));
            const portal = await cancelarEnPortal(id);
            return NextResponse.json({ ok: true, borrador, portal });
        }
        if (accion === 'cancelar-portal') {
            const portal = await cancelarEnPortal(id);
            return NextResponse.json({ ok: portal.cancelado, portal, ...(portal.cancelado ? {} : { error: `No se pudo cancelar en el portal: ${portal.motivo}` }) }, { status: portal.cancelado ? 200 : 502 });
        }
        return NextResponse.json({ error: 'La acción tiene que ser "aprobar", "reintentar", "rechazar" o "cancelar-portal".' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo actualizar el borrador.';
        const status = /no existe/.test(msg) ? 404 : /no puede pasar|tiene que hacerla|tiene que hacerlo|Decí por qué|mientras tanto|solo se cancela/.test(msg) ? 409 : 500;
        if (status === 500) console.error('[lab-modulos/borradores] PATCH:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
