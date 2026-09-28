import { NextResponse } from 'next/server';
import { alertarCuotasMalCargadas, avisarCobrosNuevos } from '@/services/mp-cobros-aviso.service';

/**
 * Cada 10 minutos: avisa por mail, WhatsApp y la campanita cada cobro nuevo de
 * la cuenta de Mercado Pago (ver src/services/mp-cobros-aviso.service.ts).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.substring(7) : null;
    if (new URL(request.url).searchParams.get('secret') !== cronSecret && token !== cronSecret) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    try {
        const cobros = await avisarCobrosNuevos();
        const cuotas = await alertarCuotasMalCargadas();
        return NextResponse.json({ ok: true, ...cobros, cuotasRevisadas: cuotas.revisados, cuotasAlertadas: cuotas.alertados });
    } catch (err: any) {
        console.error('[CRON cobros-mercadopago]', err);
        return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
    }
}
