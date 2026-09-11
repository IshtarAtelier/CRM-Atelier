import { NextResponse } from 'next/server';
import { avisarAlEquipo } from '@/lib/avisos/aviso-al-equipo';

/**
 * El wa-service le avisa algo al EQUIPO: llega como mensaje del sistema a la
 * mensajería interna (decisión de Ishtar del 10/9/2026: los avisos de "algo
 * falló, hacelo a mano" van ahí, no a la campanita de Tareas).
 *
 * Por qué una ruta: el wa-service no puede importar código de `src/` (su
 * Dockerfile no lo ve), y la mensajería tiene reglas propias —hilos,
 * participantes, dedup— que no se copian a mano en otro lado.
 *
 * Protegida por `x-api-key` (BOT_API_KEY) en el middleware, como todo /api/bot/.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { asunto, cuerpo, urgente } = await req.json();
        if (typeof asunto !== 'string' || !asunto.trim() || typeof cuerpo !== 'string' || !cuerpo.trim()) {
            return NextResponse.json({ error: 'asunto y cuerpo son requeridos' }, { status: 400 });
        }
        const llegaron = await avisarAlEquipo({
            asunto: asunto.trim().slice(0, 200),
            cuerpo: cuerpo.trim().slice(0, 4000),
            urgente: urgente === true,
        });
        return NextResponse.json({ ok: llegaron > 0, llegaron });
    } catch (error) {
        console.error('[bot/aviso-equipo] Error:', error);
        return NextResponse.json({ error: 'No se pudo avisar al equipo' }, { status: 500 });
    }
}
