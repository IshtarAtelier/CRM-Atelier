import { NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { InternalMessagingService } from '@/services/internal-messaging.service';
import { getRecoveryCoupon } from '@/lib/checkout/recovery';
import { listarPresupuestosTiendaAbiertos, cuerpoAvisoPresupuestosTienda } from '@/lib/checkout/presupuestos-tienda-abiertos';

export const dynamic = 'force-dynamic';

/**
 * Aviso diario a Ishtar con los presupuestos de la tienda sin cerrar y el
 * texto listo para escribirles por WhatsApp (ver lib/checkout/presupuestos-tienda-abiertos).
 *
 * Lo dispara el scheduler interno (instrumentation.ts) a las 9:00 ART; también
 * acepta GET /api/cron/presupuestos-tienda?secret=CRON_SECRET a mano. Va SOLO a
 * los ADMIN (pedido de Ishtar, 15/10/2026: "que me mande un mensaje a mí…
 * y yo me ocupo de escribirles"), no a los vendedores. Dedup de 20 h por el
 * primer renglón, como todo aviso del sistema.
 */
export async function GET(request: Request) {
    const auth = verifyCronAuth(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const lista = await listarPresupuestosTiendaAbiertos(prisma);
    if (!lista.length) return NextResponse.json({ ok: true, enviados: 0, motivo: 'sin presupuestos abiertos' });

    const cupon = await getRecoveryCoupon();
    const cuerpo = cuerpoAvisoPresupuestosTienda(lista, cupon);
    const dedupePrefijo = cuerpo.split('\n')[0];

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, name: true } });
    let enviados = 0;
    for (const a of admins) {
        try {
            const r = await InternalMessagingService.mensajeDeIA({
                paraUserId: a.id, cuerpo, asunto: 'Presupuestos de la tienda para retomar', dedupePrefijo,
            });
            if (r) enviados++;
        } catch (err) {
            console.error('[presupuestos-tienda] No se pudo avisar a', a.name, err);
        }
    }
    return NextResponse.json({ ok: true, abiertos: lista.length, enviados, cupon: cupon?.code || null });
}
