import { NextResponse } from 'next/server';
import { enviarConfirmacionesCompletasPendientes } from '@/lib/sale-confirmation';

/**
 * Manda la confirmación de compra COMPLETA a quien recibió solo la plantilla
 * corta (ventana de 24 h cerrada) y después volvió a escribir. Lo dispara
 * `instrumentation.ts` cada 10 minutos en horario de local, con reclamo de
 * franja en la base para que las dos instancias no lo corran a la vez.
 *
 * GET /api/cron/confirmacion-completa  (Authorization: Bearer CRON_SECRET)
 */
export async function GET(request: Request) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    if (!token || token !== cronSecret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const r = await enviarConfirmacionesCompletasPendientes();
        if (r.enviadas) console.log(`[CRON confirmacion-completa] ${r.enviadas} enviada(s), ${r.pendientes} pendiente(s) de ${r.revisadas}.`);
        return NextResponse.json({ ok: true, ...r });
    } catch (err: any) {
        console.error('[CRON confirmacion-completa] Error:', err);
        return NextResponse.json({ ok: false, error: err?.message || 'Error' }, { status: 500 });
    }
}
