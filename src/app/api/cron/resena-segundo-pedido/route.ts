import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { ReviewRequestService } from '@/services/review-request.service';

export const dynamic = 'force-dynamic';

/**
 * 2º pedido de reseña (Ishtar, 16/10/2026): "un robot que verifique los que no
 * hayan comentado y los vuelva a opiniones una vez más, para que vuelva a
 * aparecerle al vendedor".
 *
 * Lo dispara el scheduler interno (instrumentation.ts) a las 10:00 ART; a mano:
 * GET /api/cron/resena-segundo-pedido?secret=CRON_SECRET[&dryRun=1].
 *
 * NO LE ESCRIBE A NINGÚN CLIENTE. Solo crea la tarea REVIEW_REQUEST para que
 * el vendedor la vea y decida (regla del 10/8/2026). Antes cruza las reseñas
 * que devuelve Google Places para no volver a pedírsela a quien ya comentó.
 */
export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';

    // El cruce con Google es best-effort: si falla, el robot sigue igual.
    const google = await ReviewRequestService.cruzarConGoogle(dryRun)
        .catch((err: any) => ({ error: String(err?.message || err) }));

    const r = await ReviewRequestService.crearSegundosPedidos({ dryRun });
    console.log(`[CRON resena-segundo-pedido] ${dryRun ? '(seco) ' : ''}revisados ${r.revisados} · 2º pedidos ${r.creados.length} · salteados ${r.salteados.length}`);
    return NextResponse.json({ ok: true, google, ...r });
}
