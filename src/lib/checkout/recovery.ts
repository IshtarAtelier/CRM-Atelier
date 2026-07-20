import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { getWebSettings } from '@/lib/web-settings';

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface RecoveryResult {
  sent: boolean;
  skipped?: 'purchased' | 'no_email' | 'already_processed';
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

  // Reclamar la sesión ANTES de enviar: marca EMAIL_SENT de forma atómica y solo si
  // seguía PENDING. Evita que dos corridas concurrentes (o un fallo silencioso del
  // update posterior) reenvíen el email de recuperación al cliente.
  const claimed = await prisma.checkoutSession.updateMany({
    where: { id: session.id, status: 'PENDING' },
    data: { status: 'EMAIL_SENT' }
  });
  if (claimed.count === 0) return { sent: false, skipped: 'already_processed' };

  // Ya reclamada como EMAIL_SENT: TODO lo que sigue (lookup de cupón, armado del HTML,
  // envío) va en try/catch. Si algo tira (blip de DB al leer el cupón, o un item null en
  // cartData), hay que revertir a PENDING; si no, la sesión quedaría EMAIL_SENT para
  // siempre y el email de recuperación se perdería (el próximo cron ya no la reclama).
  try {
    const coupon = await getRecoveryCoupon();

    // filter(Boolean): cartData es inyectable por el POST público; un elemento null
    // rompería getClientItemsHtml (item.brand sobre null).
    const cartItems = (Array.isArray(session.cartData) ? session.cartData as any[] : []).filter(Boolean);
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
      return { sent: true };
    }
  } catch (e) {
    console.error('[recovery] error armando/enviando el email de recuperación:', e);
  }

  // Envío fallido o excepción: revertir a PENDING para reintentar en la próxima corrida.
  await prisma.checkoutSession.updateMany({
    where: { id: session.id, status: 'EMAIL_SENT' },
    data: { status: 'PENDING' }
  }).catch((e) => console.error('[recovery] no se pudo revertir a PENDING:', e));
  return { sent: false, error: 'send_failed' };
}
