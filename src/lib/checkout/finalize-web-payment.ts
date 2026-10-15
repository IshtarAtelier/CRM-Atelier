import { describirConfiguracion, tieneCristales } from '@/lib/cristales-web/claves';
import { conMarca, tieneMarca } from '@/lib/checkout/marcas-de-pago';
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
  | {
      ok: true;
      alreadyProcessed: boolean;
      orderId: string;
      stockDevuelto?: boolean;
      /**
       * El pago se aprobó pero la venta ya no esperaba ese cobro (la confirmó
       * un vendedor a mano): no se registró nada, quedó un aviso para
       * conciliar. Trae el estado en que estaba la venta.
       */
      aConciliar?: string;
    }
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
    include: { order: { include: { client: true, items: true } } },
  });

  if (!intent) return { ok: false, reason: `Intento ${intentId} inexistente.` };
  if (!intent.order) return { ok: false, reason: `Intento ${intentId} sin orden asociada.` };

  const order = intent.order;

  // Ya acreditado: cortar acá. Cubre el reintento del webhook y el aviso doble
  // (payment + merchant_order) del mismo pago.
  if (intent.status === 'APPROVED' && intent.paymentId === gatewayPaymentId) {
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

  const numero = order.id.slice(-4).toUpperCase();
  const resultado = await prisma.$transaction(async (tx) => {
    // La fila de la orden se bloquea primero, igual que en failWebPayment: si
    // el cron cancela y el aviso de pago aprobado llegan a la vez, pasan de a
    // uno y el segundo ve lo que dejó el primero (revisión del 10/10/2026).
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    // El intento, releído DESPUÉS del bloqueo: dos avisos del mismo pago
    // (payment y merchant_order) que llegan juntos pasan de a uno, y el
    // segundo corta acá en vez de repetir el aviso a conciliar.
    const intentoFresco = await tx.webPaymentIntent.findUnique({
      where: { id: intentId },
      select: { status: true, paymentId: true, lastError: true },
    });
    if (intentoFresco?.status === 'APPROVED' && intentoFresco.paymentId === gatewayPaymentId) return { tipo: 'ya-paga' as const };
    // Un pago que ya se resolvió sin acreditar (a conciliar, o sobre una venta
    // borrada) deja su id en lastError: el próximo aviso del MISMO pago corta
    // acá. Sin esto, si el intento guardaba el id de OTRO pago (un rechazo
    // previo, o el primer cobro), cada aviso volvía a firmar la ficha y a
    // mandar el mail urgente de cobro sin venta (revisión del 10/10/2026).
    if (intentoFresco?.status === 'APPROVED' && tieneMarca(intentoFresco.lastError, `[pago ${gatewayPaymentId}]`)) return { tipo: 'ya-paga' as const };
    const fresca = await tx.order.findUnique({
      where: { id: order.id },
      select: { status: true, isDeleted: true, deletedReason: true },
    });
    if (!fresca) return { tipo: 'ya-paga' as const };
    // Los cobros cargados a mano son la prueba de que una persona ya se ocupó
    // (CLAUDE.md: la venta real se mide por filas de Payment, no por `paid`).
    const cobrosCargados = await tx.payment.count({ where: { orderId: order.id } });

    // El intento se cierra en los casos que no acreditan: si quedara PENDING,
    // el chequeo periódico lo volvería a encontrar cada 10 minutos y mandaría
    // el mismo aviso para siempre (revisión del 10/10/2026). APPROVED es lo
    // que dijo Mercado Pago; lastError, por qué no se acreditó, con el id del
    // pago (es el candado de arriba). El id de un intento YA aprobado no se
    // pisa (es el candado del primer cobro); el de uno rechazado, sí.
    const cerrarIntentoSinAcreditar = (porQue: string) =>
      tx.webPaymentIntent.update({
        where: { id: intentId },
        data: {
          status: 'APPROVED',
          paymentId: intentoFresco?.status === 'APPROVED' && intentoFresco.paymentId ? intentoFresco.paymentId : gatewayPaymentId,
          gatewayStatus,
          processedAt: new Date(),
          lastError: conMarca(intentoFresco?.lastError, `[pago ${gatewayPaymentId}]`, porQue),
        },
        select: { id: true },
      });
    // Un aviso por pago: el reintento del mismo aviso no lo duplica.
    const avisarParaConciliar = async (mensaje: string) => {
      const ya = await tx.notification.findFirst({
        where: { orderId: order.id, type: 'MP_COBRO', message: { contains: gatewayPaymentId } },
        select: { id: true },
      });
      if (ya) return;
      await tx.notification.create({
        // MP_COBRO y no WEB_SALE: confirmar la venta cierra todos sus WEB_SALE
        // pendientes (confirm-web), y este aviso tiene que quedar hasta que
        // alguien concilie. Es de admin: plata que entró de más.
        data: { type: 'MP_COBRO', message: mensaje, orderId: order.id, requestedBy: actorName, status: 'PENDING' },
      });
    };

    // Pago aprobado sobre una venta que ya no estaba esperándolo:
    //  · la borró una persona desde el CRM → no se revive sola: es un cobro
    //    sin venta y lo resuelve un humano (devolver o recrear);
    //  · la canceló el sistema (rechazo de un primer intento, o vencida a las
    //    2 h) y la persona igual pagó → se reactiva y se vuelve a reservar el
    //    stock, que la cancelación había devuelto.
    const cancelada = fresca.status === 'CANCELED' || fresca.isDeleted;
    if (cancelada && fresca.deletedReason) {
      await cerrarIntentoSinAcreditar(`Pago aprobado sobre una venta que borró una persona desde el CRM (motivo: "${fresca.deletedReason}"). Cobro sin venta: resolver a mano.`);
      return { tipo: 'borrada-por-una-persona' as const, motivo: fresca.deletedReason };
    }
    // Ya estaba pagada (otro pago de Mercado Pago, o cobrada por otra vía):
    // si es OTRO pago, puede ser un cobro duplicado. No se carga nada.
    if (fresca.status === 'WEB_PAID' || fresca.status === 'PAID') {
      await cerrarIntentoSinAcreditar(`Pago ${gatewayPaymentId} aprobado sobre una venta que ya figuraba como ${fresca.status}: no se registró otro cobro. Revisar que no se haya cobrado dos veces.`);
      await avisarParaConciliar(`⚠️ Mercado Pago aprobó OTRO pago de $${formatearPrecio(amount)} (pago ${gatewayPaymentId}) para la Venta Web #${numero} de ${client?.name || 'Cliente'}, que ya estaba pagada. No se cargó: revisá en Mercado Pago si se cobró dos veces y, si es así, devolvé uno.`);
      return { tipo: 'a-conciliar' as const, estado: fresca.status };
    }

    // La venta ya no esperaba este pago: un vendedor la confirmó a mano
    // (confirm-web la pasa a PENDING, p. ej. porque el aviso de Mercado Pago no
    // llegó y la persona mostró el comprobante), ya está en el laboratorio, o
    // sigue "esperando el pago" pero alguien ya le cargó el cobro a mano.
    // Acreditarla de nuevo la devolvía a "A confirmar", cargaba un SEGUNDO
    // cobro por el total y pedía otra factura. No se toca: aviso para conciliar.
    if (!cancelada && (fresca.status !== 'WEB_PENDING' || cobrosCargados > 0)) {
      const como = fresca.status !== 'WEB_PENDING' ? 'ya estaba confirmada a mano' : 'ya tenía un cobro cargado a mano';
      await cerrarIntentoSinAcreditar(`Pago aprobado sobre una venta que ${como} (estado ${fresca.status}, ${cobrosCargados} cobro/s): no se registró otro cobro. Revisar que no se haya cobrado dos veces.`);
      await avisarParaConciliar(`⚠️ Mercado Pago acreditó $${formatearPrecio(amount)} de la Venta Web #${numero} de ${client?.name || 'Cliente'}, que ${como}. No se cargó un segundo cobro: revisá en Mercado Pago (pago ${gatewayPaymentId}) que no se haya cobrado dos veces y que el cobro cargado en la venta sea este.`);
      return { tipo: 'a-conciliar' as const, estado: fresca.status };
    }
    const sinStock: string[] = [];
    if (cancelada) {
      // Se descuenta SIEMPRE, aunque quede en negativo: si se salteara cuando
      // no alcanza y después alguien borra la venta desde el CRM (que devuelve
      // todo), aparecería stock que no existe y la web lo vendería. El negativo
      // queda marcado en la venta y en el aviso para revisarlo.
      for (const item of order.items) {
        if (!item.productId) continue;
        if (item.productCategorySnapshot === 'Cristal' || item.productCategorySnapshot === 'Tratamiento') continue;
        const antes = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
        if (!antes) continue;
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } }, select: { id: true } });
        if ((antes.stock ?? 0) < item.quantity) sinStock.push(item.productId);
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'WEB_PAID',
        paid: cobradoEsperado,
        ...(cancelada ? {
          isDeleted: false,
          labNotes: `[PAGO APROBADO DESPUÉS DE LA CANCELACIÓN]: la venta se reactivó${sinStock.length ? `; NO alcanzó el stock de ${sinStock.length} producto(s), revisar` : ' y el stock se volvió a reservar'}.\n\n` + (order.labNotes || ''),
        } : {}),
      },
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

    // Sin solicitud de factura automática (15/10/2026): la pide el vendedor.

    const mensajePagada = `Nueva Venta Web #${numero} de ${client?.name || 'Cliente'} por $${cobradoEsperado.toLocaleString('es-AR')} (PAGADA vía Mercado Pago). Revisar y confirmar en Ventas.` +
      (cancelada ? ` ⚠️ El pago llegó después de que la venta se cancelara: se reactivó${sinStock.length ? ' pero NO alcanzó el stock, revisarlo' : ''}.` : '');
    // El aviso de esta venta: el de "esperando pago" o, si ya se había
    // cancelado, el de "no pagó" (pendiente o cerrado). Uno solo por venta.
    const esperando = cancelada
      ? await tx.notification.findFirst({ where: { orderId: order.id, type: 'WEB_SALE' }, orderBy: { createdAt: 'desc' }, select: { id: true } })
      : await avisoEsperandoPago(tx, order.id);
    if (esperando) {
      // createdAt nuevo: que suba arriba de la campana, como un aviso recién llegado.
      await tx.notification.update({
        where: { id: esperando.id },
        data: { message: mensajePagada, requestedBy: 'Sistema (Web)', status: 'PENDING', createdAt: new Date() },
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
    return { tipo: 'acreditada' as const, reactivada: cancelada, sinStock };
  });

  if (resultado.tipo === 'ya-paga') return { ok: true, alreadyProcessed: true, orderId: order.id };
  // Los dos casos que NO acreditan también quedan firmados en la ficha del
  // cliente y en el AuditLog (regla de trazabilidad de CLAUDE.md).
  const firmarSinAcreditar = (texto: string, descripcion: string, extra: Record<string, unknown>) => {
    if (order.clientId) {
      prisma.interaction
        .create({ data: { clientId: order.clientId, type: 'SISTEMA', content: texto, userId: null, userName: actorName } })
        .catch((err) => console.error('Error creando Interaction de pago sin acreditar:', err));
    }
    logAudit({
      userId: null,
      userName: actorName,
      action: 'UPDATE',
      entityType: 'ORDER',
      entityId: order.id,
      details: { descripcion, gatewayPaymentId, amount, ...extra },
    }).catch((err) => console.error('Error en logAudit de pago sin acreditar:', err));
  };
  if (resultado.tipo === 'a-conciliar') {
    console.warn(`[MP FINALIZE] Orden ${order.id} (${resultado.estado}) no esperaba el pago ${gatewayPaymentId}: no se acredita, queda para conciliar.`);
    firmarSinAcreditar(
      `💳 ${actorName}: Mercado Pago aprobó $${formatearPrecio(amount)} (pago ${gatewayPaymentId}) de la Venta #${numero}, que ya estaba confirmada, cobrada o pagada. No se cargó otro cobro: revisar que no se haya cobrado dos veces.`,
      'Pago de Mercado Pago sobre una venta que no lo esperaba: no se acreditó, a conciliar',
      { estado: resultado.estado },
    );
    return { ok: true, alreadyProcessed: true, orderId: order.id, aConciliar: resultado.estado };
  }
  if (resultado.tipo === 'borrada-por-una-persona') {
    firmarSinAcreditar(
      `💳 ${actorName}: Mercado Pago aprobó $${formatearPrecio(amount)} (pago ${gatewayPaymentId}) de la Venta #${numero}, que estaba borrada (motivo: "${resultado.motivo}"). Cobro sin venta: devolver el pago o recrear la venta.`,
      'Pago de Mercado Pago sobre una venta borrada por una persona: cobro sin venta',
      { motivo: resultado.motivo },
    );
    return { ok: false, reason: `la venta #${numero} la había borrado una persona desde el CRM (motivo: "${resultado.motivo}"); no se reactiva sola` };
  }

  console.log(`[MP FINALIZE] Orden ${order.id} acreditada${resultado.reactivada ? ' (REACTIVADA: estaba cancelada)' : ''}. Pago MP ${gatewayPaymentId}.`);

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
    details: {
      status: 'WEB_PAID',
      gateway: intent.gateway,
      gatewayPaymentId,
      amount: orderTotal,
      // Un pago que llega después de la cancelación revive la venta y vuelve
      // a reservar el stock: que quede en el registro, con lo que no alcanzó.
      ...(resultado.reactivada ? { reactivada: true, productosSinStock: resultado.sinStock } : {}),
    },
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
    : gatewayStatus === 'volvio_sin_pagar'
      ? `volvió de Mercado Pago sin pagar y la venta se canceló (${queStock})`
      : `Mercado Pago no aprobó el pago (${gatewayStatus}) y la venta se canceló (${queStock})`;
  const numero = order.id.slice(-4).toUpperCase();
  const mensajeNoPago = `Venta Web #${numero} de ${nombre || 'Cliente'} por $${formatearPrecio(ctx?.emailTotal ?? order.total)}: ${queFue}. Llegó hasta la pantalla de pago: escribile${telefono ? ` al WhatsApp ${telefono}` : ''}.`;

  // Todo en UNA transacción y con reclamos atómicos (revisión del 10/10/2026).
  // Antes el stock se devolvía afuera y sin mirar el estado: dos instancias
  // corriendo el cron devolvían el stock dos veces, y se cancelaban ventas que
  // ya no esperaban el pago (confirmadas por un vendedor, o borradas desde el
  // CRM, que ya había devuelto su stock).
  const resultado = await prisma.$transaction(async (tx) => {
    // La fila de la orden primero, igual que finalizeWebPayment: el cron y un
    // pago aprobado que llega a la vez pasan de a uno.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id} FOR UPDATE`;
    // 1. El intento: solo lo cierra quien lo encuentra todavía pendiente.
    const intentoReclamado = await tx.webPaymentIntent.updateMany({
      where: { id: intentId, status: 'PENDING' },
      data: {
        status: gatewayStatus === 'expired' ? 'EXPIRED' : 'REJECTED',
        gatewayStatus,
        paymentId: gatewayPaymentId || undefined,
        processedAt: new Date(),
        lastError: motivo,
      },
    });
    if (intentoReclamado.count !== 1) return 'ya-procesado' as const;

    // 2. La orden: solo se cancela si sigue esperando el pago. Si un vendedor
    // la confirmó (pasa a PENDING), le cargó un cobro o alguien la borró del
    // CRM, la resolvió una persona y no se toca: el intento queda cerrado.
    const ordenReclamada = await tx.order.updateMany({
      // Sin cobros cargados: si un vendedor ya le cargó el pago a mano (sin
      // tocar "Confirmar"), cancelarla ocultaba la venta, sacaba el cobro de la
      // caja y devolvía el stock de un armazón vendido.
      where: { id: order.id, status: 'WEB_PENDING', isDeleted: false, payments: { none: {} } },
      data: {
        isDeleted: true,
        status: 'CANCELED',
        // Se libera la clave de idempotencia para que el comprador pueda
        // reintentar con otro medio sin quedar trabado para siempre.
        idempotencyKey: null,
        labNotes: `[PAGO NO CONCRETADO - MERCADO PAGO]: ${motivo}${devolverStock ? '' : ` Stock NO devuelto: la reserva tenía más de ${DIAS_MAX_PARA_DEVOLVER_STOCK} días (revisar el stock a mano).`}\n\n` + (order.labNotes || ''),
      },
    });
    if (ordenReclamada.count !== 1) return 'resuelta-por-una-persona' as const;

    // 3. El stock reservado vuelve, dentro de la misma transacción. Solo
    // armazones/accesorios: los cristales no descuentan stock (se fabrican).
    // updateMany: un producto que ya no existe no tira abajo la cancelación.
    if (devolverStock) {
      for (const item of order.items) {
        if (!item.productId) continue;
        if (item.productCategorySnapshot === 'Cristal' || item.productCategorySnapshot === 'Tratamiento') continue;
        await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }

    // 4. El aviso: fresco queda pendiente y sube arriba para que alguien le
    // escriba; viejo se cierra con lo que pasó, sin volver a la campana.
    const esperando = await avisoEsperandoPago(tx, order.id);
    if (esperando) {
      await tx.notification.update({
        where: { id: esperando.id },
        data: avisoFresco
          ? { message: mensajeNoPago, createdAt: new Date() }
          : { message: mensajeNoPago.replace(/Llegó hasta la pantalla de pago: escribile.*$/, 'Se cerró tarde, sin aviso.'), status: 'REJECTED' },
        select: { id: true },
      });
    }
    return 'cancelada' as const;
  });

  if (resultado === 'ya-procesado') return { ok: true, alreadyProcessed: true, orderId: order.id };
  if (resultado === 'resuelta-por-una-persona') {
    console.log(`[MP FINALIZE] Intento ${intentId} cerrado sin tocar la orden ${order.id}: ya la había resuelto una persona (confirmada o borrada).`);
    return { ok: true, alreadyProcessed: true, orderId: order.id };
  }

  console.log(
    `[MP FINALIZE] Orden ${order.id} cancelada por "${gatewayStatus}". ` +
      (devolverStock ? 'Stock repuesto.' : `Stock NO repuesto: reserva de más de ${DIAS_MAX_PARA_DEVOLVER_STOCK} días.`),
  );

  // Trazabilidad (CLAUDE.md): nota firmada en la ficha y auditoría con await,
  // porque es una mutación destructiva (la venta se cancela y se oculta).
  if (order.clientId) {
    await prisma.interaction.create({
      data: {
        clientId: order.clientId,
        type: 'SISTEMA',
        content: `🌐 Venta web #${numero} cancelada por Sistema (Mercado Pago): ${queFue}.`,
        userId: null,
        userName: 'Sistema (Mercado Pago)',
      },
    }).catch((err) => console.error('Error creando Interaction de venta web cancelada:', err));
  }
  await logAudit({
    userId: null,
    userName: 'Sistema (Mercado Pago)',
    action: 'STATUS_CHANGE',
    entityType: 'ORDER',
    entityId: order.id,
    details: { status: 'CANCELED', gatewayStatus, motivo, stockDevuelto: devolverStock },
  });

  return { ok: true, alreadyProcessed: false, orderId: order.id, stockDevuelto: devolverStock };
}
