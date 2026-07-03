import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';

// To verify Vercel Cron trigger
const CRON_SECRET = process.env.CRON_SECRET || 'atelier-cron-secret-key-2026';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    // Si viene de Vercel Cron
    if (authHeader !== `Bearer ${CRON_SECRET}` && !request.url.includes('localhost')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    // 2 hours ago
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    // 24 hours ago (so we don't message very old carts from days ago)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const abandonedSessions = await prisma.checkoutSession.findMany({
      where: {
        status: 'PENDING',
        updatedAt: {
          lte: twoHoursAgo,
          gte: twentyFourHoursAgo
        },
        phone: {
          not: null,
          notIn: ['']
        }
      }
    });

    let sentCount = 0;
    let skippedPurchased = 0;

    for (const session of abandonedSessions) {
      if (!session.phone) continue;

      // CANDADO: si el cliente ya compró (venta confirmada o vendida), no mensajear.
      if (await hasClosedOrder(session.email, session.phone)) {
        await prisma.checkoutSession.update({
          where: { id: session.id },
          data: { status: 'COMPLETED' }
        }).catch(() => {});
        skippedPurchased++;
        continue;
      }

      let waPhone = session.phone.replace(/\D/g, '');
      // Strip international prefix if present
      if (waPhone.startsWith('549')) waPhone = waPhone.substring(3);
      else if (waPhone.startsWith('54')) waPhone = waPhone.substring(2);
      // Strip leading local trunk prefix
      if (waPhone.startsWith('0')) waPhone = waPhone.substring(1);
      // Remove embedded mobile prefix '15' after area code
      if (waPhone.length > 10) {
        const match15 = waPhone.match(/^([1-3]\d{1,3})15(\d{6,8})$/);
        if (match15) waPhone = match15[1] + match15[2];
      }
      waPhone = '549' + waPhone;

      // Ensure proper waId format
      const waId = `${waPhone}@c.us`;

      const messageText = `¡Hola ${session.firstName || 'ahí'}! Soy de Atelier Óptica 👋 Vi que estabas armando tu pedido y quedó a mitad de camino. ¿Te doy una mano con algo? Cualquier duda con los cristales, el pago o el envío, contame y lo resolvemos juntos.`;

      try {
        console.log(`[Cron Abandoned Cart] Sending message to ${waPhone} for session ${session.id}`);
        const res = await fetchWa('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: waId,
            message: messageText
          })
        });

        if (res.ok) {
          // Mark as ABANDONED so we don't message them again
          await prisma.checkoutSession.update({
            where: { id: session.id },
            data: { status: 'ABANDONED' }
          });
          sentCount++;
        } else {
          console.error(`[Cron Abandoned Cart] wa-service error for ${waPhone}:`, await res.text());
        }
      } catch (err: any) {
        console.error(`[Cron Abandoned Cart] Error sending to ${waPhone}:`, err.message);
      }
    }

    return NextResponse.json({ success: true, processed: abandonedSessions.length, sent: sentCount, skippedPurchased });

  } catch (error: any) {
    console.error('[Cron Abandoned Cart] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
