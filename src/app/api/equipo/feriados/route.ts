import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { HolidayShiftsService, TeamEventsService, TeamEventsError } from '@/services/team-events.service';
import { FERIADOS_ARGENTINA } from '@/lib/constants/feriados-argentina';

export const dynamic = 'force-dynamic';

function responderError(e: unknown) {
    if (e instanceof TeamEventsError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[equipo/feriados]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}

/** GET /api/equipo/feriados?desde=AAAA-MM-DD&hasta=AAAA-MM-DD → feriados del rango con su cobertura. */
export async function GET(request: Request) {
    try {
        const sp = new URL(request.url).searchParams;
        const desde = sp.get('desde'), hasta = sp.get('hasta');
        if (!desde || !hasta) return NextResponse.json({ error: 'Faltan desde/hasta' }, { status: 400 });
        const [coberturas, equipo] = await Promise.all([HolidayShiftsService.listar(desde, hasta), TeamEventsService.listarEquipo()]);
        const feriados = FERIADOS_ARGENTINA.filter(f => f.fecha >= desde && f.fecha <= hasta);
        return NextResponse.json({ feriados, coberturas, equipo });
    } catch (e) { return responderError(e); }
}

/** PUT — crea o pisa la cobertura de una persona en un feriado. */
export async function PUT(request: Request) {
    try {
        const fila = await HolidayShiftsService.guardar(await request.json(), getActor(request));
        return NextResponse.json(fila);
    } catch (e) { return responderError(e); }
}

/** DELETE ?fecha=&userId= — vuelve a "sin cargar". */
export async function DELETE(request: Request) {
    try {
        const sp = new URL(request.url).searchParams;
        await HolidayShiftsService.borrar(sp.get('fecha') || '', sp.get('userId') || '', getActor(request));
        return NextResponse.json({ ok: true });
    } catch (e) { return responderError(e); }
}
