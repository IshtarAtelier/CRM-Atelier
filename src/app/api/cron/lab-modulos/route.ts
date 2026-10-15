import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { REGISTRO_MODULOS } from '@/services/lab-modules/registro';
import { correrSeguimiento, tocaPasadaCompleta, ultimaPasadaCompleta } from '@/services/lab-modules/corrida';
import { Borradores } from '@/services/lab-modules/carga/borrador';
import { ROBOT_DE_LABORATORIO } from '@/services/lab-modules/carga/registro';
import { LAB_GRUPO_OPTICO } from '@/services/lab-modules/grupo-optico/portal';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Pase de seguimiento de los módulos de laboratorio (src/services/lab-modules),
 * salvo Grupo Óptico, que corre en /api/cron/smartlab-sync (ver abajo). Lo
 * dispara el tick de 10 minutos de instrumentation.ts en horario comercial,
 * después de ese pase. Un módulo caído no frena a los demás.
 *
 *   GET /api/cron/lab-modulos?secret=CRON_SECRET          → pase rápido (21 días),
 *       o la pasada completa si a ese módulo le toca (una vez cada 20 h)
 *   GET /api/cron/lab-modulos?secret=CRON_SECRET&completa=1 → pasada completa
 *
 * También vence los borradores de carga que quedaron colgados (el robot corre
 * dentro de un request: un redeploy lo corta sin pasar por ERROR).
 */
const VENTANA_RAPIDA_DIAS = 21;

export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const forzarCompleta = new URL(request.url).searchParams.get('completa') === '1';
    const colgados = await Borradores.vencerColgados(ROBOT_DE_LABORATORIO).catch(err => ({ error: err?.message || String(err) }));
    const resultados = [];
    for (const modulo of REGISTRO_MODULOS) {
        // Grupo Óptico NO corre acá: su tick es /api/cron/smartlab-sync, que
        // en el mismo disparo corre el seguimiento y DESPUÉS la conciliación
        // rápida de costos (ese orden importa: lo recién terminado en el portal
        // es lo que trae importes). Correrlo también acá sería la misma pasada
        // dos veces por tick contra un portal que apenas aguanta una.
        if (modulo.clave === LAB_GRUPO_OPTICO) continue;
        const completa = forzarCompleta || tocaPasadaCompleta(await ultimaPasadaCompleta(modulo.clave), new Date());
        resultados.push(await correrSeguimiento(modulo, completa ? { esperarTurno: true } : { sinceDays: VENTANA_RAPIDA_DIAS }));
    }
    return NextResponse.json({
        timestamp: new Date().toISOString(),
        modulos: resultados.length,
        colgados,
        resultados,
    });
}
