import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { Borradores, puedeAprobar } from '@/services/lab-modules/carga/borrador';
import { httpDeError } from '@/services/lab-modules/carga/errores';
import { cargaDe } from '@/services/lab-modules/carga/registro';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * PATCH /api/lab-modulos/borradores/[id]  { accion, motivo? }
 *
 * El OK humano de la carga asistida, para cualquier laboratorio (el lab sale
 * del borrador). El actor sale del JWT que reinyecta el middleware, nunca del body.
 *  · aprobar (EN_REVISION): queda APROBADO y, en la misma llamada, el robot
 *    carga en el portal (CARGADO con el nº). Aprobar también manda al cliente
 *    el aviso de "pedido procesado", como cuando se tipea el nº a mano. Si la
 *    carga falla, queda APROBADO con el motivo y se reintenta.
 *  · reintentar (APROBADO con falla): el robot vuelve a intentar (nunca duplica).
 *  · rechazar (EN_REVISION): queda RECHAZADO; si el portal tenía un borrador
 *    (Vitolen), el robot lo cancela.
 *  · cancelar-portal (RECHAZADO / ERROR con pedido en el portal): solo en los
 *    portales que tienen borrador; recién ahí se puede preparar otro.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        const body = await request.json().catch(() => ({}));
        const accion = String(body.accion || '');
        const labDelBorrador = await Borradores.labDe(id);
        if (!labDelBorrador) return NextResponse.json({ error: 'El borrador no existe.' }, { status: 404 });
        const fila = { lab: labDelBorrador };
        const carga = cargaDe(fila.lab);
        if (!carga) return NextResponse.json({ error: `El laboratorio ${fila.lab} no tiene carga asistida.` }, { status: 400 });

        if (accion === 'aprobar' || accion === 'reintentar') {
            if (accion === 'aprobar') await Borradores.aprobar(id, actor);
            // Reintentar también crea un pedido real: lo dispara una persona identificada, y queda en el AuditLog.
            if (accion === 'reintentar') {
                if (!puedeAprobar(actor)) return NextResponse.json({ error: 'El reintento tiene que hacerlo una persona identificada.' }, { status: 403 });
                logAudit({ userId: actor.id, userName: actor.name, action: 'UPDATE', entityType: 'LAB_ORDER_DRAFT', entityId: id, details: { reintentoDeCarga: true, lab: fila.lab } }).catch(console.error);
            }
            // El robot carga FUERA del request (turno, login, portal: minutos). La
            // ficha sondea el borrador: CARGADO, o APROBADO con el error anotado.
            void Promise.resolve(carga.confirmar(id)).catch(err => console.error(`[lab-modulos] ${accion} ${id}:`, err?.message || err));
            return NextResponse.json({ ok: true, enCurso: true }, { status: 202 });
        }
        if (accion === 'rechazar') {
            const borrador = await Borradores.rechazar(id, actor, String(body.motivo || ''));
            const portal = await carga.despuesDeRechazar(id, actor);
            return NextResponse.json({ ok: true, borrador, portal });
        }
        if (accion === 'anular') {
            const borrador = await Borradores.anular(id, actor, String(body.motivo || ''));
            return NextResponse.json({ ok: true, borrador });
        }
        if (accion === 'releer') {
            if (!carga.releerPortal) return NextResponse.json({ error: `${carga.nombre} no tiene nada que releer: el pedido se arma de nuevo al preparar.` }, { status: 400 });
            const borrador = await carga.releerPortal(id, actor);
            return NextResponse.json({ ok: true, borrador });
        }
        if (accion === 'cancelar-portal') {
            if (!carga.cancelarEnPortal) return NextResponse.json({ error: `${carga.nombre} no deja borradores en el portal: no hay nada que cancelar.` }, { status: 400 });
            const portal = await carga.cancelarEnPortal(id, actor);
            return NextResponse.json({ ok: portal.cancelado, portal, ...(portal.cancelado ? {} : { error: `No se pudo cancelar en el portal: ${portal.motivo}` }) }, { status: portal.cancelado ? 200 : 502 });
        }
        return NextResponse.json({ error: 'La acción tiene que ser "aprobar", "reintentar", "rechazar", "anular", "releer" o "cancelar-portal".' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo actualizar el borrador.';
        const status = httpDeError(error);
        if (status === 500) console.error('[lab-modulos/borradores] PATCH:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
