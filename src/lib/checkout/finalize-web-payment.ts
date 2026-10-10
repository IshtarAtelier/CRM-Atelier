import { describirConfiguracion, tieneCristales } from '@/lib/cristales-web/claves';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { generateReceiptPDF } from '@/lib/receipt-pdf-generator';
import { getAdminHtml, getClientItemsHtml, getConfirmationHtml } from '@/lib/checkout/checkout-emails';
import { notifyZeroCostSale } from '@/lib/zero-cost-alert';
import { ADMIN_ALERT_EMAILS } from '@/lib/constants';
import { FACTOR_MP_CUOTAS_LARGAS } from '@/lib/constants/descuentos';
import { logAudit } from '@/lib/audit';
import { formatearPrecio } from '@/lib/format-precio';
import { MetaConversionService } from '@/services/meta-conversions.service';
import { idsDeProductos } from '@/services/ads.service';
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
  | { ok: true; alreadyProcessed: boolean; orderId: string; stockDevuelto?: boolean }
  | { ok: false; reason: string };

/**
 * Una reserva de stock de más de este tiempo ya no se devuelve sola al
 * cancelar el pago. El cron que vence los pagos no estuvo programado hasta el
 * 10/10/2026: había reservas de agosto (Orión C1, Frida C3) que, devueltas de
 * golpe, inflaban el stock si alguien ya lo había contado a mano. En la
 * marcha normal el cron cancela a las 2 h, muy lejos de este límite; un pago
 * en efectivo que Mercado Pago tiene "pendiente" varios días sí se devuelve.
 */
const DIAS_MAX_PARA_DEVOLVER_STOCK = 30;
/**
 * El aviso "no pagó: escribile" solo tiene sentido si el abandono es fresco.
 * Uno viejo se cierra sin subirlo a la campana (regla: nada viejo se reenvía).
 */
const HORAS_MAX_PARA_AVISAR_NO_PAGO = 24;

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
  /** El total cobrado lleva el 10% de costo financiero del plan de 12 cuotas MP. */
  mpCuotas12?: boolean;
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

/**
 * El aviso de una venta web por Mercado Pago es UNO por orden y cambia con el
 * pago: el checkout lo crea al abrir Mercado Pago ("… esperando pago en
 * Mercado Pago") y acá se reescribe cuando se paga o cuando no. Antes, al
 * pagar se creaba un aviso nuevo y el de "esperando pago" quedaba al lado; y
 * si no se pagaba, seguía diciendo "esperando pago" de una venta ya cancelada,
 * cuando era justo el momento de escribirle (8/10/2026).
 */
export const TEXTO_ESPERANDO_PAGO_MP = 'esperando pago en Mercado Pago';

function avisoEsperandoPago(db: { notification: typeof prisma.notification }, orderId: string) {
  return db.notification.findFirst({
    where: { orderId, type: 'WEB_SALE', status: 'PENDING', message: { contains: TEXTO_ESPERANDO_PAGO_MP } },
    select: { id: true },
  });
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
  /**
   * Cuotas reales del pago según la pasarela (solo Mercado Pago las informa).
   * Definen el método del Payment (MERCADO_PAGO_3/6_ISH) para que reportes y
   * comisiones apliquen el costo de plataforma correcto del acuerdo MP.
   */
  gatewayInstallments?: number | null;
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
  // La señal PRIMARIA es el monto del intent (lo que se mandó a cobrar a MP,
  // guardado al crear la preferencia): sobrevive aunque el checkoutContext no
  // parsee. El flag del ctx queda como respaldo.
  const esMp12 = ctx?.mpCuotas12 === true
    || Math.abs((intent.amount || 0) - Math.round(orderTotal * FACTOR_MP_CUOTAS_LARGAS)) <= 1;
  const cobradoEsperado = esMp12 ? Math.round(orderTotal * FACTOR_MP_CUOTAS_LARGAS) : orderTotal;
  const montoDifiere = Math.abs(amount - cobradoEsperado) > 1;
  // Método según el plan real: 12 con recargo → MP_12; 3/6 informadas por la
  // pasarela → MP_3/MP_6 (sus comisiones del acuerdo difieren de TARJETA);
  // 1 pago u otra pasarela (Payway no informa cuotas acá) → TARJETA, como siempre.
  const metodoPago = esMp12
    ? 'MERCADO_PAGO_12_ISH'
    : input.gatewayInstallments === 6
      ? 'MERCADO_PAGO_6_ISH'
      : input.gatewayInstallments === 3
        ? 'MERCADO_PAGO_3_ISH'
        : 'TARJETA';

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'WEB_PAID', paid: cobradoEsperado },
    });

    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: cobradoEsperado,
        method: metodoPago,
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
        message: `Factura solicitada automáticamente para la Venta #${order.id.slice(-4).toUpperCase()} por un total de $${cobradoEsperado.toLocaleString('es-AR')}${esMp12 ? ' (12 cuotas MP, incluye 10% de costo financiero)' : ''}`,
        orderId: order.id,
        requestedBy: actorName,
        status: 'PENDING',
      },
    });

    const mensajePagada = `Nueva Venta Web #${order.id.slice(-4).toUpperCase()} de ${client?.name || 'Cliente'} por $${cobradoEsperado.toLocaleString('es-AR')} (PAGADA vía Mercado Pago). Revisar y confirmar en Ventas.`;
    const esperando = await avisoEsperandoPago(tx, order.id);
    if (esperando) {
      // createdAt nuevo: que suba arriba de la campana, como un aviso recién llegado.
      await tx.notification.update({
        where: { id: esperando.id },
        data: { message: mensajePagada, requestedBy: 'Sistema (Web)', createdAt: new Date() },
        select: { id: true },
      });
    } else {
      await tx.notification.create({
        data: {
          type: 'WEB_SALE',
          message: mensajePagada,
          orderId: order.id,
          requestedBy: 'Sistema (Web)',
          status: 'PENDING',
        },
      });
    }

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
        content: `💳 Pago acreditado por ${actorName} — Orden #${order.id.slice(-4).toUpperCase()} por $${cobradoEsperado.toLocaleString('es-AR')} (${paymentNote}).`,
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
      html: `<p>Se acreditó el pago de Mercado Pago <b>${gatewayPaymentId}</b> por <b>$${cobradoEsperado.toLocaleString('es-AR')}</b> en la orden <b>${order.id}</b>, pero faltaba el contexto del checkout y no se le pudo enviar el correo de confirmación al cliente.</p>
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

  const hasCrystals = items.some((item: any) => tieneCristales(item.lensConfig));

  // Mismo desglose que usa la rama de Payway para el mail de administración.
  const itemsHtml = items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #333;">${item.brand || 'ATELIER'}</p>
          <p style="margin: 5px 0 0; font-size: 16px; color: #000;">${item.model}</p>
          ${
            tieneCristales(item.lensConfig)
              ? `
            <p style="margin: 5px 0 0; font-size: 12px; color: #666;">
              Cristales: ${describirConfiguracion(item.lensConfig)}
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
 * volver del pago, igual que en la rama de Payway. La compra va a la outbox
 * MetaConversion: queda anotada y el cron insiste si Meta no la acepta.
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

    void MetaConversionService.registrarCompraWeb(
      {
        id: order.id,
        total: orderTotal,
        client: {
          email: ctx.customer.email,
          phone: ctx.customer.phone,
          name: `${ctx.customer.firstName} ${ctx.customer.lastName}`,
          firstName: ctx.customer.firstName,
          lastName: ctx.customer.lastName,
        },
        createdAt: order.createdAt,
        contentIds: idsDeProductos(ctx.items),
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

  const edadHoras = (Date.now() - new Date(intent.createdAt).getTime()) / 3_600_000;
  const devolverStock = edadHoras <= DIAS_MAX_PARA_DEVOLVER_STOCK * 24;
  const avisoFresco = edadHoras <= HORAS_MAX_PARA_AVISAR_NO_PAGO;

  // Reponer el stock reservado al crear la orden. Solo armazones/accesorios:
  // los cristales no descuentan stock (se fabrican), igual que en el checkout.
  const restaurados: string[] = [];
  for (const item of devolverStock ? order.items : []) {
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

  // Quien llegó hasta la pantalla de pago y no pagó es el contacto más caliente
  // de la tienda: el aviso deja de decir "esperando pago" y pide escribirle.
  const ctx = parseCheckoutContext(intent.checkoutContext);
  let nombre = ctx ? `${ctx.customer.firstName || ''} ${ctx.customer.lastName || ''}`.trim() : '';
  let telefono = ctx?.customer.phone?.trim() || '';
  if ((!nombre || !telefono) && order.clientId) {
    const cliente = await prisma.client.findUnique({ where: { id: order.clientId }, select: { name: true, phone: true } });
    nombre = nombre || cliente?.name || '';
    telefono = telefono || cliente?.phone || '';
  }
  const queStock = devolverStock ? 'el stock volvió' : 'el stock NO se tocó: era una reserva vieja, revisarlo a mano';
  const queFue = gatewayStatus === 'expired'
    ? `no pagó en Mercado Pago y la venta se canceló sola (${queStock})`
    : `Mercado Pago no aprobó el pago (${gatewayStatus}) y la venta se canceló (${queStock})`;
  const mensajeNoPago = `Venta Web #${order.id.slice(-4).toUpperCase()} de ${nombre || 'Cliente'} por $${formatearPrecio(ctx?.emailTotal ?? order.total)}: ${queFue}. Llegó hasta la pantalla de pago: escribile${telefono ? ` al WhatsApp ${telefono}` : ''}.`;

  await prisma.$transaction(async (tx) => {
    const esperando = await avisoEsperandoPago(tx, order.id);
    if (esperando) {
      await tx.notification.update({
        where: { id: esperando.id },
        // Fresco: queda pendiente y sube arriba para que alguien le escriba.
        // Viejo: se cierra con lo que pasó, sin volver a la campana.
        data: avisoFresco
          ? { message: mensajeNoPago, createdAt: new Date() }
          : { message: mensajeNoPago.replace(/Llegó hasta la pantalla de pago: escribile.*$/, 'Se cerró tarde, sin aviso.'), status: 'REJECTED' },
        select: { id: true },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: {
        isDeleted: true,
        status: 'CANCELED',
        // Se libera la clave de idempotencia para que el comprador pueda
        // reintentar con otro medio sin quedar trabado para siempre.
        idempotencyKey: null,
        labNotes: `[PAGO NO CONCRETADO - MERCADO PAGO]: ${motivo}${devolverStock ? '' : ` Stock NO devuelto: la reserva tenía más de ${DIAS_MAX_PARA_DEVOLVER_STOCK} días (revisar el stock a mano).`}\n\n` + (order.labNotes || ''),
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
    `[MP FINALIZE] Orden ${order.id} cancelada por "${gatewayStatus}". ` +
      (devolverStock ? `Stock repuesto: ${restaurados.length} línea(s).` : `Stock NO repuesto: reserva de más de ${DIAS_MAX_PARA_DEVOLVER_STOCK} días.`),
  );

  logAudit({
    userId: null,
    userName: 'Sistema (Mercado Pago)',
    action: 'STATUS_CHANGE',
    entityType: 'ORDER',
    entityId: order.id,
    details: { status: 'CANCELED', gatewayStatus, motivo, stockDevuelto: devolverStock },
  }).catch((err) => console.error('Error en logAudit de pago rechazado:', err));

  return { ok: true, alreadyProcessed: false, orderId: order.id, stockDevuelto: devolverStock };
}
