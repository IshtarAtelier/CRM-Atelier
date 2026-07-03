import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { getWebSettings } from '@/lib/web-settings';

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface RecoveryResult {
  sent: boolean;
  skipped?: 'purchased' | 'no_email';
  error?: string;
}

/**
 * Envía (o decide no enviar) el email de recuperación de carrito abandonado para
 * una sesión de checkout. Lo usan tanto el cron de las 24hs como el botón manual
 * del panel de Carritos. Incluye:
 *  - Candado: nunca enviar a quien ya tiene una venta confirmada o vendida.
 *  - Cupón: si hay código + % configurados en los ajustes de la web, se muestran.
 */
export async function sendRecoveryEmailForSession(session: {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  cartData?: any;
  total?: number | null;
}): Promise<RecoveryResult> {
  if (!session.email) return { sent: false, skipped: 'no_email' };

  // CANDADO: no reenviar a quien ya compró. Reconcilia la sesión colgada en PENDING.
  if (await hasClosedOrder(session.email, session.phone)) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED' }
    }).catch(() => {});
    return { sent: false, skipped: 'purchased' };
  }

  const settings = await getWebSettings();
  const code = (settings.web_recovery_coupon_code || '').trim();
  const percent = Number(settings.web_recovery_coupon_percent) || 0;
  const coupon = code && percent > 0 ? { code, percent } : undefined;

  const cartItems = Array.isArray(session.cartData) ? session.cartData as any[] : [];
  const itemsHtml = cartItems.length
    ? getClientItemsHtml(cartItems)
    : `<tr><td style="padding: 16px 0; color: #8f897c; font-family: ${SANS}; font-size: 14px;">Tu selección de la tienda</td></tr>`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
  const customerName = session.firstName || 'Cliente';

  const result = await sendEmail({
    to: session.email,
    subject: coupon
      ? `${customerName}, tu ${percent}% OFF te espera ✦ Atelier Óptica`
      : `${customerName}, tu selección te espera ✦ Atelier Óptica`,
    html: getAbandonedCartHtml(customerName, itemsHtml, session.total || 0, `${appUrl}/checkout`, coupon),
  });

  if (result.success) {
    await prisma.checkoutSession.update({
      where: { id: session.id },
      data: { status: 'EMAIL_SENT' }
    }).catch(() => {});
    return { sent: true };
  }

  return { sent: false, error: 'send_failed' };
}
