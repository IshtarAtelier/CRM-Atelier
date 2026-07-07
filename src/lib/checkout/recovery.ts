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
 * Busca el cupón de recuperación configurado (web_recovery_coupon_code) y, si es
 * válido para mostrarse (activo, no vencido, con usos disponibles), devuelve su
 * código y una etiqueta legible del descuento. Es el MISMO código que valida el
 * checkout vía validateCoupon, así que lo que promete el email es canjeable.
 */
async function getRecoveryCoupon(): Promise<{ code: string; label: string } | undefined> {
  const settings = await getWebSettings();
  const code = (settings.web_recovery_coupon_code || '').trim().toUpperCase();
  if (!code) return undefined;

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) return undefined;
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) return undefined;
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return undefined;

  const label = coupon.discountType === 'PERCENT'
    ? `${coupon.discountValue}% OFF`
    : `$${coupon.discountValue.toLocaleString('es-AR')} OFF`;

  return { code: coupon.code, label };
}

/**
 * Envía (o decide no enviar) el email de recuperación de carrito abandonado para
 * una sesión de checkout. Lo usan el cron de las 24hs y el botón manual del panel.
 *  - Candado: nunca enviar a quien ya tiene una venta confirmada o vendida.
 *  - Cupón: si hay uno configurado y válido, se muestra su código y descuento.
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

  const coupon = await getRecoveryCoupon();

  const cartItems = Array.isArray(session.cartData) ? session.cartData as any[] : [];
  const itemsHtml = cartItems.length
    ? getClientItemsHtml(cartItems)
    : `<tr><td style="padding: 16px 0; color: #8f897c; font-family: ${SANS}; font-size: 14px;">Tu selección de la tienda</td></tr>`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';
  const customerName = session.firstName || 'Cliente';

  const result = await sendEmail({
    to: session.email,
    subject: coupon
      ? `${customerName}, tu ${coupon.label} te espera ✦ Atelier Óptica`
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
