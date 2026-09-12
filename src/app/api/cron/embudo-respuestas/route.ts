import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { tareasPorRespuestasSinAtender } from '@/lib/embudo/respuestas-a-seguimientos';

export const dynamic = 'force-dynamic';

/**
 * Tareas del vendedor por respuestas a seguimientos (últimos 14 días) y
 * limpieza de las viejas. Lo corre `correrDiario` a las 9:00; esta ruta es
 * para dispararlo a mano (GET ?secret=CRON_SECRET) sin volver a mandar el
 * resumen diario.
 */
export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    try {
        const creadas = await tareasPorRespuestasSinAtender();
        return NextResponse.json({ ok: true, creadas });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
