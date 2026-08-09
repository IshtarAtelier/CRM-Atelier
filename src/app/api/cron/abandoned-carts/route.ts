import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendRecoveryEmailForSession } from '@/lib/checkout/recovery';

/**
 * Recuperación de carritos abandonados (SOLO tienda, por email).
 * A las ~24hs de la última actividad, si el carrito sigue sin comprarse, se envía
 * el email de recuperación con el cupón (si hay uno configurado y válido).
 * El candado dentro de sendRecoveryEmailForSession evita mandar a quien ya compró.
 * Se envía una sola vez (la sesión pasa a EMAIL_SENT).
 *
 * Alta del cron: GET horario a /api/cron/abandoned-carts?secret=CRON_SECRET.
 * El `vercel.json` de la raíz declara el schedule pero NO lo ejecuta nadie: el
 * deploy es Railway, así que el alta hay que hacerla en el scheduler externo
 * (mismo criterio que el resto de los crons del proyecto).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Header Bearer o ?secret= contra CRON_SECRET (patrón de los demás crons).
    // Antes había dos agujeros: una clave por defecto hardcodeada acá —o sea
    // publicada en el repo— y un bypass `!request.url.includes('localhost')`
    // que alcanzaba con burlar mandando cualquier query string con esa palabra
    // (`?x=localhost`). Cualquiera de los dos habilitaba a un desconocido a
    // disparar una tanda de emails a clientes reales.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);
    // Piso: no perseguir carritos de hace más de 3 días
    const threeDaysAgo = new Date(now - 72 * 60 * 60 * 1000);

    const abandonedSessions = await prisma.checkoutSession.findMany({
      where: {
        status: 'PENDING',
        updatedAt: {
          lte: twentyFourHoursAgo,
          gte: threeDaysAgo
        },
        email: {
          not: null,
          notIn: ['']
        }
      }
    });

    let sent = 0;
    let skippedPurchased = 0;
    let failed = 0;

    for (const session of abandonedSessions) {
      try {
        const result = await sendRecoveryEmailForSession(session);
        if (result.sent) sent++;
        else if (result.skipped === 'purchased') skippedPurchased++;
        else failed++;
      } catch (err: any) {
        console.error(`[Cron Abandoned Cart] Error en sesión ${session.id}:`, err.message);
        failed++;
      }
    }

    console.log(`[Cron Abandoned Cart] ${sent} emails enviados, ${skippedPurchased} omitidos (ya compró), ${failed} fallidos de ${abandonedSessions.length}`);

    return NextResponse.json({
      success: true,
      processed: abandonedSessions.length,
      sent,
      skippedPurchased,
      failed
    });
  } catch (error: any) {
    console.error('[Cron Abandoned Cart] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
