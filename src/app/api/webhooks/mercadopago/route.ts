import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getMerchantOrderPayments,
  getPayment,
  isMercadoPagoEnabled,
  verifyWebhookSignature,
  type MpPayment,
} from '@/services/mercadopago.service';
import { failWebPayment, finalizeWebPayment } from '@/lib/checkout/finalize-web-payment';

/**
 * Webhook de Mercado Pago: el aviso de que un pago cambió de estado.
 *
 * Es la única puerta por la que una venta pagada con Checkout Pro pasa a estar
 * cobrada en el CRM. Tres reglas la gobiernan, y las tres son de plata:
 *
 * 1. NUNCA se le cree al body. El cuerpo del aviso solo dice "mirá el pago N";
 *    el estado se relee siempre de la API de Mercado Pago con nuestro token. Un
 *    POST falso puede decir "aprobado", pero no puede hacer que la API de MP lo
 *    confirme.
 * 2. Se valida la firma HMAC antes de gastar una consulta.
 * 3. Se responde 200 salvo que convenga que MP reintente. MP reintenta ante
 *    cualquier respuesta que no sea 2xx, así que devolver 500 por un aviso que
 *    nunca vamos a poder procesar (un pago de otra cuenta, uno sin orden) es
 *    pedir que nos lo manden en loop para siempre.
 *
 * `runtime = 'nodejs'` es obligatorio: la validación de firma usa `crypto` de
 * Node, que el runtime edge no tiene.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Respuesta de "recibido, no lo reintentes". */
function ack(detalle: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ received: true, detalle, ...extra }, { status: 200 });
}

export async function POST(req: Request) {
  // Deshabilitado: se acepta y se descarta. No 404, porque MP da de baja las
  // notificaciones tras muchos errores seguidos y no queremos que apagar el
  // respaldo por unos días nos rompa la configuración en el panel.
  if (!isMercadoPagoEnabled()) {
    console.warn('[MP WEBHOOK] Llegó un aviso con Mercado Pago deshabilitado. Se ignora.');
    return ack('Mercado Pago deshabilitado');
  }

  const url = new URL(req.url);
  const rawBody = await req.text();

  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return ack('Body ilegible');
  }

  // MP manda el id del recurso de tres formas según el tipo de aviso y la
  // antigüedad de la integración. Se aceptan las tres.
  const dataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    (body?.data?.id != null ? String(body.data.id) : null);

  const topic = url.searchParams.get('type') || url.searchParams.get('topic') || body?.type || body?.action;

  // ── Firma ──
  const firma = verifyWebhookSignature({
    signatureHeader: req.headers.get('x-signature'),
    requestIdHeader: req.headers.get('x-request-id'),
    dataId,
  });

  if (firma === false) {
    console.error('[MP WEBHOOK] Firma inválida. Aviso descartado.');
    // 401 y no 200: si alguien está probando la puerta, que no reciba un OK.
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }
  if (firma === null) {
    // Sin MP_WEBHOOK_SECRET no hay forma de verificar. Se procesa igual porque
    // el estado se relee de la API de MP (que es la defensa que de verdad
    // importa), pero queda gritado en los logs: en producción esto no va.
    console.warn(
      '[MP WEBHOOK] ⚠️ MP_WEBHOOK_SECRET no configurado: el aviso se procesa SIN validar la firma. Cargar la clave secreta del panel de Mercado Pago.',
    );
  }

  if (!dataId) return ack('Aviso sin id de recurso');

  console.log(`[MP WEBHOOK] topic=${topic} data.id=${dataId}`);

  try {
    // ── Qué pagos mirar ──
    // `payment`: uno solo. `merchant_order`: los intentos de ese carrito (un
    // comprador que reintenta con otra tarjeta genera varios).
    let pagos: MpPayment[] = [];

    if (topic === 'merchant_order') {
      pagos = await getMerchantOrderPayments(dataId);
    } else if (topic === 'payment' || String(topic || '').startsWith('payment.')) {
      pagos = [await getPayment(dataId)];
    } else {
      return ack(`Tipo de aviso no manejado: ${topic}`);
    }

    if (pagos.length === 0) return ack('Sin pagos para procesar');

    // Si hay uno aprobado, ese manda: los rechazos previos del mismo carrito no
    // deben cancelar una orden que después se pagó.
    const aprobado = pagos.find((p) => p.status === 'approved');
    const pago = aprobado || pagos[pagos.length - 1];

    const resultado = await procesarPago(pago);
    return ack(resultado.detalle, { orderId: resultado.orderId });
  } catch (err: any) {
    // Error nuestro o de la API de MP (timeout, 500). Acá SÍ queremos el
    // reintento: el aviso era válido y todavía no lo procesamos.
    console.error('[MP WEBHOOK] Error procesando el aviso:', err);
    return NextResponse.json({ error: 'Error procesando el aviso' }, { status: 500 });
  }
}

async function procesarPago(pago: MpPayment): Promise<{ detalle: string; orderId?: string }> {
  // Candado de idempotencia: si este pago ya se procesó, cortar sin volver a
  // tocar la venta. MP reintenta el mismo aviso y además lo manda por dos vías.
  const yaProcesado = await prisma.webPaymentIntent.findUnique({
    where: { paymentId: pago.id },
    select: { id: true, orderId: true, status: true },
  });
  if (yaProcesado && yaProcesado.status !== 'PENDING') {
    console.log(`[MP WEBHOOK] Pago ${pago.id} ya procesado (${yaProcesado.status}). Se ignora.`);
    return { detalle: 'Ya procesado', orderId: yaProcesado.orderId };
  }

  // Encontrar el intento: primero por la metadata que nosotros mismos pusimos,
  // después por external_reference (id de la orden). Dos caminos porque MP no
  // siempre devuelve los dos campos en todos los avisos.
  const intentIdMeta = pago.metadata?.intent_id ? String(pago.metadata.intent_id) : null;
  const orderId = pago.externalReference;

  let intent = intentIdMeta
    ? await prisma.webPaymentIntent.findUnique({ where: { id: intentIdMeta } })
    : null;

  if (!intent && orderId) {
    intent = await prisma.webPaymentIntent.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!intent) {
    // Un pago real sin intento nuestro es plata que entró sin venta asociada.
    // No se puede resolver solo, pero no puede pasar en silencio.
    console.error(
      `[MP WEBHOOK] ⚠️ Pago ${pago.id} (${pago.status}, $${pago.amount}) sin intento asociado. external_reference=${orderId}`,
    );
    if (pago.status === 'approved') {
      const { sendEmail } = await import('@/lib/email');
      const { ADMIN_ALERT_EMAILS } = await import('@/lib/constants');
      await sendEmail({
        to: ADMIN_ALERT_EMAILS,
        subject: '⚠️ URGENTE: cobro de Mercado Pago sin venta asociada',
        html: `<p>Mercado Pago aprobó el pago <b>${pago.id}</b> por <b>$${pago.amount.toLocaleString('es-AR')}</b>, pero no hay ninguna venta en el CRM esperando ese pago.</p>
               <p>Referencia externa: <b>${orderId || '(vacía)'}</b> · Pagador: ${pago.payerEmail || 'desconocido'}</p>
               <p>Hay que buscarlo en el panel de Mercado Pago y registrar o devolver la venta a mano. <b>No reponer stock automáticamente.</b></p>`,
      }).catch((err) => console.error('Error avisando pago huérfano:', err));
    }
    return { detalle: 'Sin intento asociado' };
  }

  switch (pago.status) {
    case 'approved': {
      const cuotas = pago.installments && pago.installments > 1 ? ` · ${pago.installments} cuotas` : '';
      const medio = pago.paymentMethodId ? ` · ${pago.paymentMethodId}` : '';
      const r = await finalizeWebPayment({
        intentId: intent.id,
        gatewayPaymentId: pago.id,
        gatewayStatus: pago.status,
        amount: pago.amount,
        actorName: 'Sistema (Mercado Pago)',
        paymentNote: `Pago aprobado por Mercado Pago${medio}${cuotas}`,
      });
      return {
        detalle: r.ok ? (r.alreadyProcessed ? 'Ya acreditado' : 'Acreditado') : `No acreditado: ${r.reason}`,
        orderId: r.ok ? r.orderId : undefined,
      };
    }

    case 'rejected':
    case 'cancelled': {
      const r = await failWebPayment({
        intentId: intent.id,
        gatewayPaymentId: pago.id,
        gatewayStatus: pago.status,
        motivo: pago.statusDetail || pago.status,
      });
      return {
        detalle: r.ok ? 'Rechazado, stock repuesto' : `Error: ${r.reason}`,
        orderId: r.ok ? r.orderId : undefined,
      };
    }

    case 'refunded':
    case 'charged_back': {
      // Una devolución o un contracargo NO se procesan solos: deshacer una
      // venta ya entregada es una decisión del negocio, no del webhook.
      console.warn(`[MP WEBHOOK] ${pago.status} del pago ${pago.id} sobre la orden ${intent.orderId}.`);
      await prisma.webPaymentIntent.update({
        where: { id: intent.id },
        data: { gatewayStatus: pago.status, lastError: `Mercado Pago informó "${pago.status}". Requiere revisión manual.` },
      });
      const { sendEmail } = await import('@/lib/email');
      const { ADMIN_ALERT_EMAILS } = await import('@/lib/constants');
      await sendEmail({
        to: ADMIN_ALERT_EMAILS,
        subject: `⚠️ Mercado Pago informó "${pago.status}" en una venta web`,
        html: `<p>El pago <b>${pago.id}</b> de la venta <b>${intent.orderId}</b> pasó a <b>${pago.status}</b> por $${pago.amount.toLocaleString('es-AR')}.</p>
               <p>La venta NO se modificó automáticamente. Revisar en el panel de Mercado Pago y decidir qué hacer.</p>`,
      }).catch((err) => console.error('Error avisando devolución/contracargo:', err));
      return { detalle: `${pago.status}: avisado, sin cambios automáticos`, orderId: intent.orderId };
    }

    default: {
      // pending / in_process: todavía no hay nada que decidir. Se deja anotado
      // el estado y se espera el próximo aviso.
      await prisma.webPaymentIntent.update({
        where: { id: intent.id },
        data: { gatewayStatus: pago.status },
      });
      return { detalle: `En espera (${pago.status})`, orderId: intent.orderId };
    }
  }
}

/**
 * MP a veces valida la URL con un GET antes de habilitarla en el panel.
 * Responde OK sin exponer absolutamente nada.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
