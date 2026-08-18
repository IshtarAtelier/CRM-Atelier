import { NextResponse } from 'next/server';
import { sincronizarGastosDeAds } from '@/services/gastos-ads.service';

export const dynamic = 'force-dynamic';

/**
 * Mantiene al día los renglones "Meta Ads" / "Google Ads" de /admin/gastos con
 * lo gastado en el mes en curso, sin que nadie tenga que copiarlo a mano.
 *
 * Alta en cron-job.org: GET diario a /api/cron/gastos-ads-diario?secret=CRON_SECRET
 * Buen horario: a la madrugada, después de que el gasto de ayer ya cerró en
 * las dos plataformas (mismo horario que conviene para /api/cron/ads-report).
 *
 * ES UN NÚMERO "A LA FECHA", no el total del mes: crece día a día y recién es
 * definitivo el último día. Mismo criterio que los costos de laboratorio de
 * esa misma pantalla, que también se recalculan solos — acá con un cron en
 * vez de en cada carga de la página, porque la fuente son dos APIs externas
 * (ver gastos-ads.service.ts).
 *
 * SI UNA PLATAFORMA NO SE PUDO LEER, no se toca su renglón (mejor un número de
 * ayer que un cero falso) y el endpoint responde ok:false para que el run
 * quede en rojo en cron-job.org. No manda mail aparte: el mail diario de
 * /api/cron/ads-report ya avisa "Meta sin leer" / "Google sin leer" — dos
 * alarmas para lo mismo es peor que una, porque la segunda se deja de mirar.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const secret = token || searchParams.get('secret');

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
        }
        if (secret !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const resultado = await sincronizarGastosDeAds();

        return NextResponse.json({
            ok: resultado.saltados.length === 0,
            ...resultado,
        });
    } catch (error: any) {
        console.error('[cron gastos-ads-diario] Error:', error?.message);
        return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
    }
}
