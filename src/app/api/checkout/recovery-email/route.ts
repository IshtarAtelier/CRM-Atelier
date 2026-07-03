import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/db';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID requerido' }, { status: 400 });
    }

    const session = await prisma.checkoutSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    if (!session.email) {
      return NextResponse.json({ error: 'El cliente no tiene email registrado' }, { status: 400 });
    }

    // CANDADO: nunca enviar carrito abandonado a quien ya tiene una venta confirmada o vendida.
    if (await hasClosedOrder(session.email, session.phone)) {
      // Reconciliar la sesión que quedó colgada en PENDING pese a que la compra se concretó.
      await prisma.checkoutSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' }
      }).catch(() => {});
      return NextResponse.json({
        error: 'Este cliente ya tiene una compra confirmada o vendida. No se envió el email.'
      }, { status: 409 });
    }

    const customerName = session.firstName || 'Cliente';
    const cartItems = Array.isArray(session.cartData) ? session.cartData as any[] : [];
    const total = session.total || 0;
    // El carrito vive en localStorage del cliente: /checkout lo restaura si vuelve
    // desde el mismo navegador; si está vacío, la página ofrece volver a la tienda.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
    const ctaUrl = `${appUrl}/checkout`;

    const itemsHtml = cartItems.length
      ? getClientItemsHtml(cartItems)
      : `<tr><td style="padding: 16px 0; color: #8f897c; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px;">Tu selección de la tienda</td></tr>`;

    const result = await sendEmail({
      to: session.email,
      subject: `${customerName}, tu selección te espera ✦ Atelier Óptica`,
      html: getAbandonedCartHtml(customerName, itemsHtml, total, ctaUrl),
    });

    if (result.success) {
      // Mark session as email-sent
      await prisma.checkoutSession.update({
        where: { id: sessionId },
        data: { status: 'EMAIL_SENT' },
      });

      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: 'Error al enviar el email' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Recovery Email] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
