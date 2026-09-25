import { NextResponse } from 'next/server';
import { GoogleOfflineConversionsService } from '@/services/google-offline-conversions.service';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Sube a Google Ads las ventas cerradas que empezaron con un clic en un anuncio
// de Google (conversiones offline). Diario. Ver el runbook:
// docs/conversiones-offline-google.md.
//
//  · ?seco=1    → Google valida el lote y no registra nada (para probar).
//  · ?dias=N    → ventana de cierre a revisar (default 10, máximo 90).
//
// Como todos los crons del proyecto: informa, no corrige. Si la carga está
// apagada por entorno (GOOGLE_ADS_UPLOAD_CONVERSIONS / la acción de
// conversión), responde `bloqueo` con el motivo y no toca nada. Un run "ok"
// con `subidas: 0` no es un error: la mayoría de las ventas no vienen de un
// clic de Google, y está bien que no se suban.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
        if (secret !== cronSecret && token !== cronSecret) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const seco = searchParams.get('seco') === '1';
        const diasCrudo = Number(searchParams.get('dias') || 10);
        const dias = Number.isFinite(diasCrudo) && diasCrudo > 0 ? diasCrudo : 10;

        const resumen = await GoogleOfflineConversionsService.subirVentasCerradas({ dias, validateOnly: seco });
        const ok = resumen.errores.length === 0 && !resumen.bloqueo;
        console.log(
            `[cron/google-conversiones] ${seco ? 'SECO ' : ''}ventas=${resumen.ventas} conClic=${resumen.conClic} subidas=${resumen.subidas} validadas=${resumen.validadas} yaSubidas=${resumen.yaSubidas} errores=${resumen.errores.length}${resumen.bloqueo ? ` BLOQUEO: ${resumen.bloqueo}` : ''}`,
        );
        return NextResponse.json({ ok, ...resumen });
    } catch (error) {
        console.error('[cron/google-conversiones] Error:', error);
        return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 });
    }
}
