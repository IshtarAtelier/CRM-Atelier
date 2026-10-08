import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { TeamEventsService, TeamEventsError } from '@/services/team-events.service';

export const dynamic = 'force-dynamic';

function responderError(e: unknown) {
    if (e instanceof TeamEventsError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[equipo/novedades]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

/** GET /api/equipo/novedades?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&userId=] */
export async function GET(request: Request) {
    try {
        const sp = new URL(request.url).searchParams;
        const desde = sp.get('desde');
        const hasta = sp.get('hasta');
        if (!desde || !hasta) return NextResponse.json({ error: 'Faltan desde/hasta' }, { status: 400 });
        const [novedades, equipo, pendientes] = await Promise.all([
            TeamEventsService.listar(desde, hasta, sp.get('userId')),
            TeamEventsService.listarEquipo(),
            TeamEventsService.pendientes(),
        ]);
        return NextResponse.json({ novedades, equipo, pendientes });
    } catch (e) { return responderError(e); }
}

/** POST /api/equipo/novedades — crea una novedad. */
export async function POST(request: Request) {
    try {
        const actor = getActor(request);
        const body = await request.json();
        const ev = await TeamEventsService.crear(body, actor);
        return NextResponse.json(ev, { status: 201 });
    } catch (e) { return responderError(e); }
}
