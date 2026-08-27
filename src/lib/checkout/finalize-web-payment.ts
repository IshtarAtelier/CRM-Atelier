import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';
import { getAdminHtml, getClientItemsHtml, getConfirmationHtml } from '@/lib/checkout/checkout-emails';
import { notifyZeroCostSale } from '@/lib/zero-cost-alert';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { FACTOR_MP_CUOTAS_LARGAS } from '@/lib/constants/descuentos';
import { logAudit } from '@/lib/audit';
import { AdsService } from '@/services/ads.service';
import { recordServerEvent } from '@/lib/analytics';

/**
 * Acredita una compra web que se cobró FUERA de nuestro servidor.
 *
 * Payway no pasa por acá: cobra dentro del mismo request del checkout y hace
 * todo esto en línea. Esto es para Checkout Pro de Mercado Pago, donde el "sí,
 * entró la plata" llega minutos después por webhook, desde un servidor de MP,
 * sin navegador y sin el carrito original.
 *
 * Es IDEMPOTENTE por diseño, y no por prolijidad: Mercado Pago reintenta el
 * mismo aviso varias veces, y además manda dos familias de evento (`payment` y
 * `merchant_order`) que suelen referirse al MISMO pago. Sin idempotencia, una
 * venta terminaría con tres filas de Payment, tres pedidos de factura y el
 * cliente con tres correos. El candado real es la unicidad de
 * `WebPaymentIntent.paymentId` en la base; los chequeos de acá son la primera
 * barrera, no la única.
 */

export type FinalizeResult =
  | { ok: true; alreadyProcessed: boolean; orderId: string }
  | { ok: false; reason: string };

/**
 * Lo que el checkout guarda al abrir el pago para que el correo del cliente
 * salga IGUAL que el de una compra por Payway.
 *
 * Se persiste en `WebPaymentIntent.checkoutContext` en vez de reconstruirse
 * desde las líneas de la orden porque la orden guarda los cristales partidos en
 * OD y OI: rearmar el mail desde ahí le mostraría al comprador tres renglones
 * ("armazón", "cristal OD", "cristal OI") donde eligió un par de anteojos.
 */
export interface CheckoutContext {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    paymentMethod?: string;
  };
  /** Ítems tal como los eligió el comprador (armazón + su lensConfig), no las líneas de la orden. */
  items: any[];
  shippingMethodLabel: string;
  /** Total que se le cobró. Es el que va en el mail y en la medición. */
  emailTotal: number;
  /** Atribución capturada en el navegador al iniciar el pago. */
  tracking?: {
    analyticsSessionId?: string | null;
    fbp?: string | null;
    fbc?: string | null;
    gclid?: string | null;
    clientIp?: string | null;
    userAgent?: string | null;
  };
}

export function parseCheckoutContext(raw: string | null | undefined): CheckoutContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.customer?.email) return null;
    return parsed as CheckoutContext;
  } catch {
    return null;
  }
}

interface FinalizeInput {
  intentId: string;
  /** Id del pago en la pasarela. Es el candado de idempotencia. */
  gatewayPaymentId: string;
  gatewayStatus: string;
  /** Lo efectivamente acreditado, según la pasarela. */
  amount: number;
  /** Etiqueta del actor, p. ej. 'Sistema (Mercado Pago)'. */
  actorName: string;
  /** Texto para la nota del Payment, p. ej. 'Mercado Pago · visa · 3 cuotas'. */
  paymentNote: string;
}

/**
 * Marca la venta como cobrada y dispara todo lo que cuelga de eso.
 *
 * Orden deliberado: primero la transacción de base (orden pagada + fila de
 * Payment + notificaciones) y recién después los correos y la medición. Si un
 * correo falla, la plata YA quedó registrada — al revés, un mail enviado sobre
 * una venta que no se guardó es una promesa que el CRM no puede cumplir.
 */
export async function finalizeWebPayment(input: FinalizeInput): Promise<FinalizeResult> {
  const { intentId, gatewayPaymentId, gatewayStatus, amount, actorName, paymentNote } = input;

  const intent = await prisma.webPaymentIntent.findUnique({
    where: { id: intentId },
    include: { order: { include: { client: true } } },
  });

  if (!intent) return { ok: false, reason: `Intento ${intentId} inexistente.` };
  if (!intent.order) return { ok: false, reason: `Intento ${intentId} sin orden asociada.` };

  const order = intent.order;

  // Ya acreditado: cortar acá. Cubre el reintento del webhook y el aviso doble
  // (payment + merchant_order) del mismo pago.
  if (intent.status === 'APPROVED' && intent.paymentId === gatewayPaymentId) {
    return { ok: true, alreadyProcessed: true, orderId: order.id };
  }

  // La orden ya está paga por otra vía (p. ej. alguien la cobró a mano en el
  // CRM mientras el comprador pagaba online). No se toca la venta; se deja el
  // intento marcado para que el rastro quede y un humano concilie.
  if (order.status === 'WEB_PAID' || order.status === 'PAID') {
    await prisma.webPaymentIntent.update({
      where: { id: intentId },
      data: {
        status: 'APPROVED',
        paymentId: gatewayPaymentId,
        gatewayStatus,
        processedAt: new Date(),
        lastError: `La orden ya figuraba como ${order.status} antes de acreditar este pago. Revisar que no haya cobro duplicado.`,
      },
    });
    console.warn(
      `[MP FINALIZE] Orden ${order.id} ya estaba en ${order.status} al llegar el pago ${gatewayPaymentId}. Requiere conciliación manual.`,
    );
    return { ok: true, alreadyProcessed: true, orderId: order.id };
  }

  const ctx = parseCheckoutContext(intent.checkoutContext);
  const client = order.client;

  // El monto que se registra es el de la orden, no el que informa la pasarela.
  // Regla del proyecto: un cobro no redefine el precio de la venta. Si la
  // pasarela dice otra cifra, se registra la de la venta y se deja la
  // diferencia anotada para que un humano la mire.
  const orderTotal = order.total;
  // 12 cuotas por Mercado Pago: el comprador pagó lista × 1,10 (10% de costo
  // financiero elegido en el checkout). El cobro esperado y el método del
  // Payment cambian; la conversión de saldo del CRM divide por 1,10 y todo
  // cierra contra el precio de lista de la venta.
  const esMp12 = (ctx as any)?.mpCuotas12 === true;
  const cobradoEsperado = esMp12 ? Math.round(orderTotal * FACTOR_MP_CUOTAS_LARGAS) : orderTotal;
  const montoDifiere = Math.abs(amount - cobradoEsperado) > 1;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'WEB_PAID', paid: cobradoEsperado },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: cobradoEsperado,
        method: esMp12 ? 'MERCADO_PAGO_12_ISH' : 'TARJETA',
        cardMode: 'LINK',
        notes:
          `${paymentNote}. ID de pago: ${gatewayPaymentId}.` +
          (esMp12 ? ' Plan 12 cuotas con 10% de costo financiero.' : '') +
          (montoDifiere
            ? ` ⚠️ La pasarela informó $${amount.toLocaleString('es-AR')} y lo esperado era $${cobradoEsperado.toLocaleString('es-AR')}: verificar.`
            : ''),
        createdById: null,
        createdByName: actorName,
      },
    });

    await tx.notification.create({
      data: {
        type: 'INVOICE_REQUEST',
        message: `Factura solicitada automáticamente para la Venta #${order.id.slice(-4).toUpperCase()} por un total de $${orderTotal.toLocaleString('es-AR')}`,
        orderId: order.id,
        requestedBy: actorName,
        status: 'PENDING',
      },
    });

    await tx.notification.create({
      data: {
        type: 'WEB_SALE',
        message: `Nueva Venta Web #${order.id.slice(-4).toUpperCase()} de ${client?.name || 'Cliente'} por $${orderTotal.toLocaleString('es-AR')} (Tarjeta - PAGADA vía Mercado Pago). Revisar y confirmar en Ventas.`,
        orderId: order.id,
        requestedBy: 'Sistema (Web)',
        status: 'PENDING',
      },
    });

    // Dentro de la MISMA transacción: si esto falla, no queremos una venta
    // marcada como pagada cuyo intento sigue figurando pendiente — esa
    // combinación es la que haría que un reintento del webhook cobre de nuevo.
    await tx.webPaymentIntent.update({
      where: { id: intentId },
      data: {
        status: 'APPROVED',
        paymentId: gatewayPaymentId,
        gatewayStatus,
        processedAt: new Date(),
        lastError: null,
      },
    });
  });

  console.log(`[MP FINALIZE] Orden ${order.id} acreditada. Pago MP ${gatewayPaymentId}.`);

  // Trazabilidad (regla del proyecto): Interaction firmada + AuditLog.
  prisma.interaction
    .create({
      data: {
        clientId: order.clientId,
        type: 'SISTEMA',
        content: `💳 Pago acreditado por ${actorName} — Orden #${order.id.slice(-4).toUpperCase()} por $${orderTotal.toLocaleString('es-AR')} (${paymentNote}).`,
        userId: null,
        userName: actorName,
      },
    })
    .catch((err) => console.error('Error creando Interaction de pago Mercado Pago:', err));

  logAudit({
    userId: null,
    userName: actorName,
    action: 'STATUS_CHANGE',
    entityType: 'ORDER',
    entityId: order.id,
    details: { status: 'WEB_PAID', gateway: intent.gateway, gatewayPaymentId, amount: orderTotal },
  }).catch((err) => console.error('Error en logAudit de pago Mercado Pago:', err));

  // Cupón: se cuenta recién ahora, con la plata adentro.
  if (intent.couponCode) {
    try {
      const { incrementCouponUsage } = await import('@/lib/coupons');
      await incrementCouponUsage(intent.couponCode);
    } catch (err) {
      console.error('[MP FINALIZE] Error contando el uso del cupón:', err);
    }
  }

  // ── Correos ──
  // Sin contexto guardado igual se acredita la venta; lo que se pierde es el
  // mail bonito. Se avisa a los administradores para que lo manden a mano.
  if (ctx) {
    try {
      await enviarCorreos({ order, ctx });
    } catch (err) {
      console.error('[MP FINALIZE] Error enviando correos post-acreditación:', err);
    }
  } else {
    console.error(`[MP FINALIZE] Orden ${order.id} sin checkoutContext: no se pudo armar el email.`);
    sendEmail({
      to: ADMIN_ALERT_EMAILS,
      subject: `⚠️ Venta web #${order.id.slice(-4).toUpperCase()} acreditada sin email al cliente`,
      html: `<p>Se acreditó el pago de Mercado Pago <b>${gatewayPaymentId}</b> por <b>$${orderTotal.toLocaleString('es-AR')}</b> en la orden <b>${order.id}</b>, pero faltaba el contexto del checkout y no se le pudo enviar el correo de confirmación al cliente.</p>
             <p>La venta está registrada y cobrada. Hay que avisarle al cliente a mano.</p>`,
    }).catch((err) => console.error('Error avisando la falta de contexto:', err));
  }

  // Red de seguridad: avisar si alguna línea quedó con costo $0.
  notifyZeroCostSale(order.id).catch((err) =>
    console.error('Error en alerta de costo $0 (pago Mercado Pago):', err),
  );

  if (ctx) medirCompra({ order, ctx, orderTotal });

  return { ok: true, alreadyProcessed: false, orderId: order.id };
}

async function enviarCorreos(opts: {
  order: { id: string; total: number };
  ctx: CheckoutContext;
}) {
  const { order, ctx } = opts;
  const { customer, items, shippingMethodLabel, emailTotal } = ctx;

  const hasCrystals = items.some(
    (item: any) => item.lensConfig && (item.lensConfig.lensType !== 'NONE' || item.lensConfig.color),
  );

  // Mismo desglose que usa la rama de Payway para el mail de administración.
  const itemsHtml = items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #333;">${item.brand || 'ATELIER'}</p>
          <p style="margin: 5px 0 0; font-size: 16px; color: #000;">${item.model}</p>
          ${
            item.lensConfig && (item.lensConfig.lensType !== 'NONE' || item.lensConfig.color)
              ? `
            <p style="margin: 5px 0 0; font-size: 12px; color: #666;">
              Cristales: ${item.lensConfig.lensType === 'NONE' ? 'Sin Aumento' : item.lensConfig.lensType}
              ${item.lensConfig.treatment ? `- ${item.lensConfig.treatment.replace(/_/g, ' ')}` : ''}
              ${item.lensConfig.color ? `<br/>Tinte: ${item.lensConfig.color}` : ''}
              ${item.lensConfig.prescriptionFile ? `<br/>Receta: ${item.lensConfig.prescriptionFile}` : ''}
            </p>
          `
              : ''
          }
        </td>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee; text-align: right; font-size: 14px;">
          $${(item.price * item.quantity).toLocaleString('es-AR')}
        </td>
      </tr>
    `,
    )
    .join('');

  const confirmationHtml = getConfirmationHtml(
    customer,
    order.id,
    emailTotal,
    shippingMethodLabel,
    hasCrystals,
    getClientItemsHtml(items),
  );
  const adminHtml = getAdminHtml(customer, order.id, emailTotal, shippingMethodLabel, false, itemsHtml);

  // Recibo en PDF adjunto, igual que en una compra por Payway.
  let attachments: any[] = [];
  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { client: true, payments: true },
  });
  const paymentRecord = updatedOrder?.payments?.[updatedOrder.payments.length - 1];
  if (updatedOrder && paymentRecord) {
    try {
      const pdfData = await generateReceiptPDF(paymentRecord, updatedOrder, updatedOrder.client);
      attachments = [
        {
          filename: pdfData.filename,
          content: pdfData.base64.split('base64,')[1] || pdfData.base64,
          encoding: 'base64',
        },
      ];
    } catch (pdfErr) {
      console.error('[MP EMAIL] Error generando el recibo PDF, se manda el mail sin adjunto:', pdfErr);
    }
  }

  try {
    await sendEmail({
      to: customer.email,
      subject: `Confirmación de Orden #${order.id.slice(-6).toUpperCase()} - Atelier Óptica`,
      html: confirmationHtml,
      attachments,
    });
    console.log('[MP EMAIL] Email de confirmación enviado a cliente:', customer.email);
  } catch (err) {
    console.error('[MP EMAIL] Error enviando email a cliente:', err);
  }

  try {
    await sendEmail({
      to: ADMIN_ALERT_EMAILS,
      subject: `🛒 Nueva Compra Web - $${emailTotal.toLocaleString('es-AR')} - ${customer.firstName} ${customer.lastName}`,
      html: adminHtml,
      attachments,
    });
  } catch (err) {
    console.error('[MP EMAIL] Error enviando email a administradores:', err);
  }
}

/**
 * Espeja la compra a la analítica propia y al Conversions API de Meta.
 *
 * Los datos de coincidencia (fbp/fbc/IP/user-agent) salen del contexto guardado
 * al abrir el pago, NO de este request: acá el que llama es un servidor de
 * Mercado Pago. Sin ese rescate, toda compra por esta puerta llegaría a Meta
 * ciega y las campañas la valorarían mucho menos de lo que vale.
 *
 * `event_id = order.id` deduplica contra el evento que dispara el navegador al
 * volver del pago, igual que en la rama de Payway.
 */
function medirCompra(opts: { order: { id: string; createdAt: Date }; ctx: CheckoutContext; orderTotal: number }) {
  const { order, ctx, orderTotal } = opts;
  const t = ctx.tracking || {};
  try {
    recordServerEvent({
      type: 'purchase',
      sessionId: t.analyticsSessionId || `web-${order.id}`,
      value: orderTotal,
      orderId: order.id,
      meta: {
        channel: 'web',
        paymentMethod: 'TARJETA',
        gateway: 'MERCADO_PAGO',
        ...(t.gclid ? { gclid: t.gclid } : {}),
        ...(t.fbc ? { fbc: t.fbc } : {}),
      },
    });

    AdsService.sendWebPurchase(
      {
        id: order.id,
        total: orderTotal,
        client: {
          email: ctx.customer.email,
          phone: ctx.customer.phone,
          name: `${ctx.customer.firstName} ${ctx.customer.lastName}`,
        },
        createdAt: order.createdAt,
      },
      {
        eventSourceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://atelieroptica.com.ar'}/checkout`,
        matchData: {
          fbc: typeof t.fbc === 'string' ? t.fbc.slice(0, 500) : null,
          fbp: typeof t.fbp === 'string' ? t.fbp.slice(0, 100) : null,
          clientIp: t.clientIp || null,
          userAgent: t.userAgent || null,
        },
      },
    );
  } catch (err) {
    console.error('[MP FINALIZE] Error midiendo la compra (no afecta la venta):', err);
  }
}

/**
 * Un pago que no prosperó (rechazado, cancelado o vencido).
 *
 * Devuelve el stock reservado y esconde la orden, igual que hace la rama de
 * Payway con un rechazo. Es lo que impide que un checkout abandonado en la
 * pantalla de Mercado Pago deje mercadería reservada para siempre.
 */
export async function failWebPayment(opts: {
  intentId: string;
  gatewayPaymentId?: string | null;
  gatewayStatus: string;
  motivo: string;
}): Promise<FinalizeResult> {
  const { intentId, gatewayPaymentId, gatewayStatus, motivo } = opts;

  const intent = await prisma.webPaymentIntent.findUnique({
    where: { id: intentId },
    include: { order: { include: { items: true } } },
  });
  if (!intent) return { ok: false, reason: `Intento ${intentId} inexistente.` };
  if (!intent.order) return { ok: false, reason: `Intento ${intentId} sin orden asociada.` };

  const order = intent.order;

  // Nunca deshacer una venta ya cobrada: un aviso tardío de "rechazado" sobre
  // una orden acreditada sería devolver stock de mercadería vendida.
  if (intent.status === 'APPROVED' || order.status === 'WEB_PAID' || order.status === 'PAID') {
    console.warn(
      `[MP FINALIZE] Llegó "${gatewayStatus}" para la orden ${order.id} que ya está acreditada. Se ignora.`,
    );
    return { ok: true, alreadyProcessed: true, orderId: order.id };
  }

  if (intent.status === 'REJECTED' || intent.status === 'EXPIRED') {
    return { ok: true, alreadyProcessed: true, orderId: order.id };
  }

  // Reponer el stock reservado al crear la orden. Solo armazones/accesorios:
  // los cristales no descuentan stock (se fabrican), igual que en el checkout.
  const restaurados: string[] = [];
  for (const item of order.items) {
    if (!item.productId) continue;
    if (item.productCategorySnapshot === 'Cristal' || item.productCategorySnapshot === 'Tratamiento') continue;
    try {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      restaurados.push(item.productId);
    } catch (err) {
      console.error(`[MP FINALIZE] Error restaurando stock de ${item.productId}:`, err);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        isDeleted: true,
        status: 'CANCELED',
        // Se libera la clave de idempotencia para que el comprador pueda
        // reintentar con otro medio sin quedar trabado para siempre.
        idempotencyKey: null,
        labNotes: `[PAGO NO CONCRETADO - MERCADO PAGO]: ${motivo}\n\n` + (order.labNotes || ''),
      },
    });
    await tx.webPaymentIntent.update({
      where: { id: intentId },
      data: {
        status: gatewayStatus === 'expired' ? 'EXPIRED' : 'REJECTED',
        gatewayStatus,
        paymentId: gatewayPaymentId || undefined,
        processedAt: new Date(),
        lastError: motivo,
      },
    });
  });

  console.log(
    `[MP FINALIZE] Orden ${order.id} cancelada por "${gatewayStatus}". Stock repuesto: ${restaurados.length} línea(s).`,
  );

  logAudit({
    userId: null,
    userName: 'Sistema (Mercado Pago)',
    action: 'STATUS_CHANGE',
    entityType: 'ORDER',
    entityId: order.id,
    details: { status: 'CANCELED', gatewayStatus, motivo },
  }).catch((err) => console.error('Error en logAudit de pago rechazado:', err));

  return { ok: true, alreadyProcessed: false, orderId: order.id };
}
