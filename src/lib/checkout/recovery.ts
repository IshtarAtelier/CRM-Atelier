import { prisma } from '@/lib/db';
import { esCompradorRobot, ESTADO_ROBOT } from '@/lib/checkout/robots';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { getWebSettings } from '@/lib/web-settings';
import { STORE_ORIGIN } from '@/lib/constants';
import { effectiveFramePrice } from '@/lib/checkout/checkout-pricing';

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

/**
 * Marca la sesión como cerrada porque la persona ya compró (reconcilia el
 * PENDING colgado). Si antes había recibido algún toque del recupero, queda
 * RECOVERED y no COMPLETED: es la única forma de saber cuántos carritos volvió
 * a traer el recupero. El estado existía en el schema y en los comentarios,
 * pero nadie lo escribía nunca — el embudo de la tienda no podía medir su
 * propio resultado.
 */
async function markPurchased(sessionId: string): Promise<RecoveryResult> {
  const tocada = await prisma.checkoutSession.findUnique({ where: { id: sessionId }, select: { recoveryStage: true } });
  await prisma.checkoutSession.update({
    where: { id: sessionId },
    data: { status: (tocada?.recoveryStage ?? 0) > 0 ? 'RECOVERED' : 'COMPLETED' }
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
  // El robot de Google no es un cliente: no se le escribe (ver robots.ts).
  if (esCompradorRobot(session.email)) return { sent: false, skipped: 'no_email' };

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
    html: getAbandonedCartHtml(customerName, itemsHtml, session.total || 0, linkDeRecupero(session.id), coupon),
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


// ── Reponer el carrito desde el mail de recupero ────────────────────────────
//
// Auditoría del 25/9/2026: el mail llevaba a /checkout pelado y el carrito vive
// en el navegador (localStorage). Quien lo abría desde el celular después de
// haber empezado en la compu —o desde otro navegador— veía "Tu carrito está
// vacío": el mail invitaba a volver a una compra que ya no estaba. Sobre 12
// sesiones reales que recibieron el mail, 0 volvieron.
//
// Ahora el link lleva el id de la sesión y el checkout repone los productos
// desde `CheckoutSession.cartData`, que ya se guardaba.

/** Estados en los que el carrito ya no se repone: la persona compró, o no es una persona. */
export const ESTADOS_SIN_CARRITO_RECUPERABLE = ['COMPLETED', 'RECOVERED', 'FINALIZED', ESTADO_ROBOT] as const;

/** Link del mail de recupero: abre el checkout con los productos de esa sesión. */
export function linkDeRecupero(sessionId: string): string {
  return `${STORE_ORIGIN}/checkout?recuperar=${encodeURIComponent(sessionId)}`;
}

/** Lo que se devuelve para reponer: solo productos, ningún dato de la persona. */
export interface ItemRecuperado {
  productId: string;
  brand: string;
  model: string;
  price: number;
  basePrice: number;
  image: string;
  lensColor: string | null;
  lensConfig: unknown;
  quantity: number;
  stock?: number;
}

/** Los ids de sesión son cuid: letras minúsculas y números. Cualquier otra cosa no se consulta. */
export function esIdDeSesionValido(id: string | null | undefined): id is string {
  return !!id && /^[a-z0-9]{20,40}$/.test(id);
}

/**
 * Los productos de un carrito abandonado, listos para volver a cargarlos.
 *
 * - Solo si la sesión sigue abierta: nunca se repone la compra de alguien que
 *   ya pagó (se le duplicaría el pedido).
 * - El armazón vuelve con el precio de HOY (`effectiveFramePrice`, el mismo
 *   con el que cobra el checkout): si subió desde que se armó el carrito, un
 *   precio viejo haría rebotar el pago con "Discrepancia de precio", un error
 *   que el cliente no puede resolver. Los cristales se ponen al día solos en el
 *   carrito (`useCristalesAlDia`).
 * - Un producto que ya no existe se saca.
 * - No devuelve email, nombre, teléfono ni dirección: el link viaja por mail y
 *   se puede reenviar.
 */
export async function carritoRecuperable(sessionId: string, db = prisma): Promise<ItemRecuperado[]> {
  if (!esIdDeSesionValido(sessionId)) return [];
  const sesion = await db.checkoutSession.findUnique({ where: { id: sessionId }, select: { status: true, cartData: true } });
  if (!sesion || (ESTADOS_SIN_CARRITO_RECUPERABLE as readonly string[]).includes(sesion.status)) return [];

  const guardados = Array.isArray(sesion.cartData) ? (sesion.cartData as any[]) : [];
  const ids = [...new Set(guardados.map(i => String(i?.productId || '')).filter(Boolean))];
  if (ids.length === 0) return [];
  const productos = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, price: true, salePrice: true, wholesalePrice: true, stock: true },
  });
  const porId = new Map(productos.map(p => [p.id, p]));

  const items: ItemRecuperado[] = [];
  for (const g of guardados) {
    const producto = porId.get(String(g?.productId || ''));
    if (!producto) continue;
    const armazonHoy = effectiveFramePrice(producto, false);
    const basePrevio = Number(g.basePrice ?? g.price) || 0;
    const extrasCristales = Math.max(0, (Number(g.price) || 0) - basePrevio);
    items.push({
      productId: producto.id,
      brand: String(g.brand || ''),
      model: String(g.model || ''),
      price: armazonHoy + extrasCristales,
      basePrice: armazonHoy,
      image: String(g.image || ''),
      lensColor: g.lensColor ?? null,
      lensConfig: g.lensConfig ?? null,
      quantity: Math.max(1, Math.floor(Number(g.quantity) || 1)),
      stock: typeof producto.stock === 'number' ? producto.stock : undefined,
    });
  }
  return items;
}
