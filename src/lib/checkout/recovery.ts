import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { getWebSettings } from '@/lib/web-settings';
import { STORE_ORIGIN } from '@/lib/constants';

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/**
 * Toques del recupero. El de las 24hs es el que existía; el temprano se agregó
 * porque un solo intento a las 24hs llega tarde para el que se cayó del checkout
 * por una duda puntual (una cuota, un plazo de entrega) y ese mismo día ya
 * compró en otro lado.
 *
 *  - EARLY (~1h): recordatorio a secas, SIN cupón. Regalar el descuento a la
 *    hora es pagarle a gente que iba a volver sola; el cupón es la carta del
 *    segundo toque, no la del primero.
 *  - LATE (~24h): el mail de siempre, con cupón si hay uno válido.
 */
export type RecoveryTouch = 'EARLY' | 'LATE';

/**
 * `CheckoutSession.recoveryStage` guarda hasta qué toque llegó cada carrito.
 * Es un número y no un estado nuevo a propósito: `status` sigue significando en
 * qué punto del ciclo está la sesión (PENDING / EMAIL_SENT / RECOVERED /
 * COMPLETED / ABANDONED / FINALIZED) y lo leen el panel de Oportunidades de
 * Cierre y el de analítica. Si el toque temprano moviera `status`, el carrito
 * desaparecería del panel de la vendedora una hora después de abandonado.
 */
export const RECOVERY_STAGE: Record<RecoveryTouch, number> = { EARLY: 1, LATE: 2 };

// 'WHATSAPP' ya no se escribe (ver runRecoveryTouch), pero sigue en el tipo
// porque está guardado en `CheckoutSession.recoveryChannel` de los carritos que
// pasaron por ahí y el panel los lee.
export type RecoveryChannel = 'EMAIL' | 'WHATSAPP';

export interface RecoveryResult {
  sent: boolean;
  channel?: RecoveryChannel;
  skipped?: 'purchased' | 'no_email' | 'already_touched';
  error?: string;
}

export interface RecoverableSession {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  cartData?: any;
  total?: number | null;
  clientId?: string | null;
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
 * Reclama el toque ANTES de mandarlo. Devuelve false si otra corrida (o un
 * reintento del scheduler pisándose con la anterior) ya se lo llevó.
 *
 * Va en SQL crudo por dos motivos que Prisma no da juntos:
 *  1) `UPDATE ... WHERE recoveryStage < N` es atómico: dos procesos corriendo el
 *     cron a la vez no pueden reclamar el mismo toque, gane quien gane.
 *  2) `@updatedAt` NO se mueve. `updatedAt` es el reloj del abandono (última
 *     actividad del cliente en el checkout) y es con lo que se miden las
 *     ventanas de 1h/24h/72h: si marcar el toque temprano lo pisara, el toque de
 *     las 24hs se correría 24hs más y no llegaría nunca dentro de la ventana.
 *
 * Si el envío posterior falla, el toque queda consumido y no se reintenta. Es a
 * propósito: perder un recordatorio es barato, mandar dos veces el mismo mail
 * (que es lo que pasaba marcando después de enviar) quema al cliente.
 */
async function claimRecoveryTouch(sessionId: string, touch: RecoveryTouch, channel: RecoveryChannel): Promise<boolean> {
  const stage = RECOVERY_STAGE[touch];
  const claimed = await prisma.$executeRaw`
    UPDATE "CheckoutSession"
       SET "recoveryStage" = ${stage},
           "recoveryTouchAt" = NOW(),
           "recoveryChannel" = ${channel}
     WHERE "id" = ${sessionId}
       AND "recoveryStage" < ${stage}
       AND "status" = 'PENDING'`;
  return claimed === 1;
}

/** Marca la sesión como cerrada porque la persona ya compró (reconcilia el PENDING colgado). */
async function markPurchased(sessionId: string): Promise<RecoveryResult> {
  await prisma.checkoutSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED' }
  }).catch(() => {});
  return { sent: false, skipped: 'purchased' };
}

/**
 * Envía (o decide no enviar) el email de recuperación de carrito abandonado para
 * una sesión de checkout. Lo usan el cron (toques EARLY y LATE) y el botón
 * manual del panel.
 *  - Candado: nunca enviar a quien ya tiene una venta confirmada o vendida.
 *  - Cupón: solo en el toque de las 24hs (y en el envío manual), si hay uno
 *    configurado y válido.
 *  - Sin `touch` es el camino manual de siempre: no reclama nada y se puede
 *    reenviar a mano cuantas veces decida la vendedora.
 */
export async function sendRecoveryEmailForSession(
  session: RecoverableSession,
  opts: { touch?: RecoveryTouch } = {}
): Promise<RecoveryResult> {
  if (!session.email) return { sent: false, skipped: 'no_email' };

  // CANDADO: no reenviar a quien ya compró. Reconcilia la sesión colgada en PENDING.
  if (await hasClosedOrder(session.email, session.phone)) {
    return markPurchased(session.id);
  }

  const { touch } = opts;
  if (touch && !(await claimRecoveryTouch(session.id, touch, 'EMAIL'))) {
    return { sent: false, skipped: 'already_touched' };
  }

  const coupon = touch === 'EARLY' ? undefined : await getRecoveryCoupon();

  const cartItems = Array.isArray(session.cartData) ? session.cartData as any[] : [];
  const itemsHtml = cartItems.length
    ? getClientItemsHtml(cartItems)
    : `<tr><td style="padding: 16px 0; color: #8f897c; font-family: ${SANS}; font-size: 14px;">Tu selección de la tienda</td></tr>`;

  // Mail al cliente: el botón vuelve a la tienda pública, nunca a la URL de Railway.
  const appUrl = STORE_ORIGIN;
  const customerName = session.firstName || 'Cliente';

  const subject = touch === 'EARLY'
    ? `${customerName}, te guardamos tu selección ✦ Atelier Óptica`
    : coupon
      ? `${customerName}, tu ${coupon.label} te espera ✦ Atelier Óptica`
      : `${customerName}, tu selección te espera ✦ Atelier Óptica`;

  const result = await sendEmail({
    to: session.email,
    subject,
    html: getAbandonedCartHtml(customerName, itemsHtml, session.total || 0, `${appUrl}/checkout`, coupon),
  });

  if (result.success) {
    // El toque temprano NO toca `status`: el carrito sigue siendo una
    // oportunidad abierta para la vendedora hasta que se agote el recupero.
    if (touch !== 'EARLY') {
      await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'EMAIL_SENT',
          recoveryStage: RECOVERY_STAGE.LATE,
          recoveryTouchAt: new Date(),
          recoveryChannel: 'EMAIL',
        }
      }).catch(() => {});
    }
    return { sent: true, channel: 'EMAIL' };
  }

  return { sent: false, error: 'send_failed' };
}

/**
 * Un toque del recupero multi-toque. Los dos salen por MAIL.
 *
 * Hasta el 5/9/2026 el toque de las 24hs prefería WhatsApp cuando el cliente ya
 * tenía chat abierto: en vez de mandar el mail, creaba una `ClientTask`
 * '[CARRITO]' que redactaba y enviaba `wa-service/followups/smart-task-executor.js`.
 * Ese ejecutor vive en el transporte viejo (WhatsApp Web) y NO existe en la API
 * oficial — o sea que desde la migración la tarea se creaba, el toque se daba
 * por consumido (`recoveryStage = 2`), la función devolvía `sent: true`… y al
 * cliente no le llegaba absolutamente nada. Y le pasaba justo a los mejores:
 * los que ya tenían conversación abierta.
 *
 * Mandar el mail siempre es además lo que decidió el plan de la migración
 * (docs/plan-whatsapp-api-oficial.md, C9: "SE VA por WhatsApp; el toque por
 * email sigue"). El toque por WhatsApp lo da una persona desde el panel de
 * Oportunidades de Cierre, donde el carrito sigue apareciendo con su botón.
 */
export async function runRecoveryTouch(session: RecoverableSession, touch: RecoveryTouch): Promise<RecoveryResult> {
  return sendRecoveryEmailForSession(session, { touch });
}
