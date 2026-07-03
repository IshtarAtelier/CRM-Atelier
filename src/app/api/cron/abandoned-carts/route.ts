import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendRecoveryEmailForSession } from '@/lib/checkout/recovery';

// To verify Vercel Cron trigger
const CRON_SECRET = process.env.CRON_SECRET || 'atelier-cron-secret-key-2026';

/**
 * Recuperación de carritos abandonados (SOLO tienda, por email).
 * A las ~24hs de la última actividad, si el carrito sigue sin comprarse, se envía
 * el email de recuperación con el cupón (si está configurado en los ajustes de la web).
 * El candado dentro de sendRecoveryEmailForSession evita mandar a quien ya compró.
 * Se envía una sola vez (la sesión pasa a EMAIL_SENT).
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}` && !request.url.includes('localhost')) {
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
