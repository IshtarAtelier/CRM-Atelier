import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchWa } from '@/lib/wa-config';

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

    for (const session of abandonedSessions) {
      if (!session.phone) continue;

      let waPhone = session.phone.replace(/\D/g, '');
      if (waPhone.startsWith('0')) waPhone = waPhone.substring(1);
      if (waPhone.startsWith('15')) waPhone = '9' + waPhone.substring(2);
      if (!waPhone.startsWith('54')) waPhone = '54' + waPhone;

      // Ensure proper waId format
      const waId = `${waPhone}@c.us`;

      const messageText = `¡Hola ${session.firstName || 'ahí'}! Vimos que dejaste unos anteojos en tu carrito en Atelier Óptica 😎 ¿Tuviste algún problema con el pago o necesitás ayuda con los cristales? Avisanos y te asesoramos.\n\nPara que puedas cerrar tu compra hoy, te dejo un *cupón de 5% de descuento extra* usando el código: *CUPON5* 🎁`;

      try {
        console.log(`[Cron Abandoned Cart] Sending message to ${waPhone} for session ${session.id}`);
        const res = await fetchWa('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            waId: waId,
            text: messageText,
            chatId: null // It will create or find the chat
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

    return NextResponse.json({ success: true, processed: abandonedSessions.length, sent: sentCount });

  } catch (error: any) {
    console.error('[Cron Abandoned Cart] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
