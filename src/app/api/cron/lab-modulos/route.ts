import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { REGISTRO_MODULOS } from '@/services/lab-modules/registro';
import { correrSeguimiento } from '@/services/lab-modules/corrida';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Pase de seguimiento de los módulos de laboratorio (src/services/lab-modules).
 * Lo dispara el tick de 10 minutos de instrumentation.ts en horario comercial,
 * después del pase de SmartLab. Un módulo caído no frena a los demás.
 *
 *   GET /api/cron/lab-modulos?secret=CRON_SECRET          → pase rápido (21 días)
 *   GET /api/cron/lab-modulos?secret=CRON_SECRET&completa=1 → pasada completa
 */
const VENTANA_RAPIDA_DIAS = 21;

export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const completa = new URL(request.url).searchParams.get('completa') === '1';
    const resultados = [];
    for (const modulo of REGISTRO_MODULOS) {
        resultados.push(await correrSeguimiento(modulo, completa ? { esperarTurno: true } : { sinceDays: VENTANA_RAPIDA_DIAS }));
    }
    return NextResponse.json({
        timestamp: new Date().toISOString(),
        modulos: REGISTRO_MODULOS.length,
        resultados,
    });
}
