import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getAbandonedCartHtml, getClientItemsHtml } from '@/lib/checkout/checkout-emails';
import { hasClosedOrder } from '@/lib/checkout/purchase-guard';
import { getWebSettings } from '@/lib/web-settings';
import { STORE_ORIGIN } from '@/lib/constants';
import { logAudit } from '@/lib/audit';
import { SYSTEM_ACTOR } from '@/lib/actor';
import { normalizeArgentinePhone } from '@/services/contact.service';

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Toques del recupero. El de las 24hs es el que existía; el temprano se agregó
 * porque un solo intento a las 24hs llega tarde para el que se cayó del checkout
 * por una duda puntual (una cuota, un plazo de entrega) y ese mismo día ya
 * compró en otro lado.
 *
 *  - EARLY (~1h): recordatorio a secas, SIN cupón. Regalar el descuento a la
 *    hora es pagarle a gente que iba a volver sola; el cupón es la carta del
 *    segundo toque, no la del primero.
 *  - LATE (~24h): el mail de siempre, con cupón si hay uno válido — o un toque
 *    por WhatsApp en su lugar cuando el cliente ya tiene chat abierto.
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

/** Un solo toque de retención por cliente cada 14 días (regla compartida con posventa/renovación/reseña). */
const RETENCION_EXCLUSION_DIAS = 14;
const RETENCION_CREADO_POR = 'Sistema (Retención)';
const CARRITO_PREFIJO = '[CARRITO]';

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

/** Primer nombre, para que la tarea no diga "Hola María Fernanda De Los Santos". */
function primerNombre(nombre?: string | null): string {
  return ((nombre || '').trim().split(/\s+/)[0]) || '';
}

/** Qué había en el carrito, en una línea. Sin precios de ítem: el único número que sale es el total guardado. */
function resumenDelCarrito(cartData: unknown): string {
  const items = Array.isArray(cartData) ? (cartData as any[]) : [];
  if (items.length === 0) return 'su selección de la tienda';
  return items
    .slice(0, 3)
    .map(i => [i.brand, i.model].filter(Boolean).join(' ') || i.category || 'un producto')
    .join(', ');
}

type WhatsAppTouchTarget = { chatId: string; clientId: string; clientName: string | null };

/**
 * ¿Se le puede tocar por WhatsApp en vez de mandarle otro mail?
 *
 * Solo si ya hay conversación abierta CON mensajes entrantes. Escribirle primero
 * a alguien que nunca nos habló es lo que hace que reporten el número: el Cold
 * Contact Shield del ejecutor lo cancelaría igual, pero cancelándolo deja una
 * tarea muerta colgada en la ficha. Se chequea acá para no crearla.
 *
 * Se replican los cortes del pipeline de seguimientos (SIN_SEGUIMIENTO, pausa de
 * la compuerta, un solo toque de retención cada 14 días) por la misma razón.
 */
async function findWhatsAppTouchTarget(session: RecoverableSession): Promise<WhatsAppTouchTarget | null> {
  const normalized = normalizeArgentinePhone(session.phone);
  // '549' pelado significa que no había dígitos reales.
  const last8 = normalized.length > 3 ? normalized.slice(-8) : null;
  if (!session.clientId && !last8) return null;

  // El teléfono del checkout se tipea como sale (con 0, con 15, con +54), así
  // que el cruce va por los últimos 8 dígitos, que son los que no cambian entre
  // formatos. `waId` los trae adentro ("5493511234567@c.us").
  const matchers: any[] = [];
  if (session.clientId) matchers.push({ clientId: session.clientId });
  if (last8) matchers.push({ waId: { contains: last8 } }, { realPhone: { contains: last8 } });

  const chat = await prisma.whatsAppChat.findFirst({
    where: { archived: false, clientId: { not: null }, OR: matchers },
    // Los clientes con dos chats (@c.us y @lid) quedaban evaluados contra el
    // chat equivocado sin este orden.
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      chatLabels: true,
      followUpPausedUntil: true,
      client: { select: { name: true } },
    },
  });
  // Sin ficha asociada no hay a quién colgarle la tarea (y el ejecutor no
  // encontraría el chat para responder).
  if (!chat?.clientId) return null;

  const labels = chat.chatLabels || [];
  if (labels.includes('SIN_SEGUIMIENTO')) return null;
  if (chat.followUpPausedUntil && chat.followUpPausedUntil.getTime() > Date.now()) return null;

  const inbound = await prisma.whatsAppMessage.findFirst({
    where: { chatId: chat.id, direction: 'INBOUND' },
    select: { id: true },
  });
  if (!inbound) return null;

  const desde = new Date(Date.now() - RETENCION_EXCLUSION_DIAS * DIA_MS);
  const toqueReciente = await prisma.clientTask.findFirst({
    // Cualquier estado: una tarea de retención cancelada o fallada igual consumió
    // el turno del cliente. Y de paso es el dedup de este mismo flujo.
    where: { clientId: chat.clientId, createdBy: RETENCION_CREADO_POR, createdAt: { gte: desde } },
    select: { id: true },
  });
  if (toqueReciente) return null;

  return { chatId: chat.id, clientId: chat.clientId, clientName: chat.client?.name ?? null };
}

/**
 * Toque por WhatsApp: NO manda nada acá. Crea la ClientTask '[CARRITO] ...' con
 * createdBy 'Sistema (Retención)' y la redacta, la pasa por la compuerta y la
 * envía `wa-service/followups/smart-task-executor.js`. Así hereda la cola
 * anti-ban, la ventana horaria y el interruptor `followups_enabled` sin
 * construir un sexto sistema de seguimientos.
 */
async function createWhatsAppRecoveryTask(
  session: RecoverableSession,
  target: WhatsAppTouchTarget,
  touch: RecoveryTouch
): Promise<RecoveryResult> {
  if (await hasClosedOrder(session.email, session.phone)) {
    return markPurchased(session.id);
  }

  if (!(await claimRecoveryTouch(session.id, touch, 'WHATSAPP'))) {
    return { sent: false, skipped: 'already_touched' };
  }

  // El cupón se nombra solo si existe y está vigente en la base — nunca un
  // código escrito a mano acá, que es como se termina prometiendo un descuento
  // vencido (misma regla que el mail).
  const coupon = await getRecoveryCoupon();
  const nombre = primerNombre(session.firstName) || primerNombre(target.clientName) || 'el cliente';

  // La descripción es literalmente el pedido que lee el redactor del ejecutor:
  // se escribe como instrucción para él, no como nota interna, porque todo lo
  // que diga acá puede terminar en el mensaje al cliente.
  //
  // Por eso NO lleva el importe. El total de la sesión quedó congelado cuando la
  // persona abandonó el carrito, y este mensaje sale hasta 72 horas después: si
  // el precio cambió en el medio, repetírselo por WhatsApp es cotizarle un valor
  // que ya no existe. Decir "no le pases precios nuevos" no evita que repita el
  // viejo; la única forma de que no lo diga es no dárselo. Que vuelva a la
  // tienda y lo vea vigente.
  const description =
    `${CARRITO_PREFIJO} ${nombre} dejó un carrito en la tienda con ${resumenDelCarrito(session.cartData)} ` +
    `y no lo terminó. Preguntale si tuvo alguna duda con la compra y ` +
    `ofrecele ayuda para terminarla` +
    (coupon ? `, contándole que tiene el cupón ${coupon.code} (${coupon.label}) disponible` : '') +
    `. No menciones importes ni ofrezcas otro descuento: si pregunta por el precio, invitalo a verlo en la tienda.`;

  const task = await prisma.clientTask.create({
    data: {
      clientId: target.clientId,
      description,
      type: 'TASK',   // el ejecutor solo levanta type 'TASK'
      status: 'PENDING',
      // Vence ahora: la ventana horaria real (9-19 AR) la vuelve a chequear el
      // ejecutor antes de mandar, así que adelantarla acá no manda nada a
      // deshora y sí evita perder el toque del día.
      dueDate: new Date(),
      createdBy: RETENCION_CREADO_POR,
    },
    select: { id: true },
  });

  logAudit({
    userId: SYSTEM_ACTOR.id,
    userName: SYSTEM_ACTOR.name,
    action: 'CREATE',
    entityType: 'TASK',
    entityId: task.id,
    details: { origen: 'Carrito abandonado (toque WhatsApp)', checkoutSessionId: session.id, clientId: target.clientId },
  }).catch(console.error);

  return { sent: true, channel: 'WHATSAPP' };
}

/**
 * Un toque del recupero multi-toque. Elige el canal:
 *  - EARLY: siempre mail (a la hora, escribirle al WhatsApp es acoso).
 *  - LATE: WhatsApp si hay chat con entrantes — es donde se cierra el 100% de
 *    las ventas altas — y mail en cualquier otro caso.
 *
 * Nunca los dos: el segundo toque es UNO, cambia el canal, no se duplica.
 */
export async function runRecoveryTouch(session: RecoverableSession, touch: RecoveryTouch): Promise<RecoveryResult> {
  if (touch === 'LATE') {
    const target = await findWhatsAppTouchTarget(session);
    if (target) return createWhatsAppRecoveryTask(session, target, touch);
  }
  return sendRecoveryEmailForSession(session, { touch });
}
