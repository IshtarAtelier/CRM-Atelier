import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { puedeCargarEnLaboratorio } from '@/lib/lab-carga-acceso';
import { Borradores } from '@/services/lab-modules/carga/borrador';
import { httpDeError } from '@/services/lab-modules/carga/errores';
import { cargaDe } from '@/services/lab-modules/carga/registro';

export const dynamic = 'force-dynamic';

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
 *  · anular (APROBADO con falla / PREPARADO colgado que nunca mandó nada): ERROR, firmado.
 *  · retirar-aprobacion (APROBADO que nunca mandó nada, sin robot vivo): vuelve a
 *    EN_REVISION para rechazarlo o volver a aprobarlo — la salida humana cuando
 *    el robot no puede confirmar (portal caído, credencial rechazada).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const actor = getActor(request);
        if (!(await puedeCargarEnLaboratorio(actor))) {
            return NextResponse.json({ error: 'La carga en el portal es de Ishtar y Milena.', sinAcceso: true }, { status: 403 });
        }
        const body = await request.json().catch(() => ({}));
        const accion = String(body.accion || '');
        const labDelBorrador = await Borradores.labDe(id);
        if (!labDelBorrador) return NextResponse.json({ error: 'El borrador no existe.' }, { status: 404 });
        const fila = { lab: labDelBorrador };
        const carga = cargaDe(fila.lab);
        if (!carga) return NextResponse.json({ error: `El laboratorio ${fila.lab} no tiene carga asistida.` }, { status: 400 });

        if (accion === 'aprobar' || accion === 'reintentar') {
            if (accion === 'aprobar') await Borradores.aprobar(id, actor);
            // Reintentar también crea un pedido real: persona identificada, se limpia el
            // error viejo y se toma el candado del robot (su identidad) para que un
            // segundo clic reciba 409 mientras el primero trabaja.
            const robot = accion === 'reintentar' ? await Borradores.reintentar(id, actor) : null;
            // El robot carga FUERA del request (turno, login, portal: minutos). La
            // ficha sondea el borrador: CARGADO, o APROBADO con el error anotado.
            void Promise.resolve(carga.confirmar(id, { robot })).catch(err => console.error(`[lab-modulos] ${accion} ${id}:`, err?.message || err));
            return NextResponse.json({ ok: true, enCurso: true }, { status: 202 });
        }
        if (accion === 'retirar-aprobacion') {
            // Vuelve a revisión sin tocar el portal: desde ahí se rechaza o se vuelve a aprobar.
            const borrador = await Borradores.retirarAprobacion(id, actor, String(body.motivo || ''));
            return NextResponse.json({ ok: true, borrador });
        }
        if (accion === 'rechazar') {
            const borrador = await Borradores.rechazar(id, actor, String(body.motivo || ''));
            // Lo que haya que hacer en el portal (Vitolen cancela el borrador) va fuera del request.
            void Promise.resolve(carga.despuesDeRechazar(id, actor)).catch(err => console.error(`[lab-modulos] después de rechazar ${id}:`, err?.message || err));
            return NextResponse.json({ ok: true, borrador, enCurso: true }, { status: 202 });
        }
        if (accion === 'anular') {
            const borrador = await Borradores.anular(id, actor, String(body.motivo || ''));
            return NextResponse.json({ ok: true, borrador });
        }
        if (accion === 'releer') {
            if (!carga.releerPortal) return NextResponse.json({ error: `${carga.nombre} no tiene nada que releer: el pedido se arma de nuevo al preparar.` }, { status: 400 });
            void Promise.resolve(carga.releerPortal(id, actor)).catch(err => console.error(`[lab-modulos] releer ${id}:`, err?.message || err));
            return NextResponse.json({ ok: true, enCurso: true }, { status: 202 });
        }
        if (accion === 'cancelar-portal') {
            if (!carga.cancelarEnPortal) return NextResponse.json({ error: `${carga.nombre} no deja borradores en el portal: no hay nada que cancelar.` }, { status: 400 });
            void Promise.resolve(carga.cancelarEnPortal(id, actor)).catch(err => console.error(`[lab-modulos] cancelar en el portal ${id}:`, err?.message || err));
            return NextResponse.json({ ok: true, enCurso: true }, { status: 202 });
        }
        return NextResponse.json({ error: 'La acción tiene que ser "aprobar", "reintentar", "rechazar", "anular", "retirar-aprobacion", "releer" o "cancelar-portal".' }, { status: 400 });
    } catch (error: any) {
        const msg = error?.message || 'No se pudo actualizar el borrador.';
        const status = httpDeError(error);
        if (status === 500) console.error('[lab-modulos/borradores] PATCH:', error);
        return NextResponse.json({ error: msg }, { status });
    }
}
