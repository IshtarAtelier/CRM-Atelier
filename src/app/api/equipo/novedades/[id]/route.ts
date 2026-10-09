import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { TeamEventsService, TeamEventsError } from '@/services/team-events.service';

export const dynamic = 'force-dynamic';

function responderError(e: unknown) {
    if (e instanceof TeamEventsError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[equipo/novedades/id]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

/** PATCH — `{ decision: 'APROBADO'|'RECHAZADO' }` decide; cualquier otro campo edita. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        const actor = getActor(request);
        const body = await request.json();
        const ev = body.decision
            ? await TeamEventsService.decidir(id, body.decision, actor)
            : await TeamEventsService.editar(id, body, actor);
        return NextResponse.json(ev);
    } catch (e) { return responderError(e); }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await ctx.params;
        await TeamEventsService.borrar(id, getActor(request));
        return NextResponse.json({ ok: true });
    } catch (e) { return responderError(e); }
}
