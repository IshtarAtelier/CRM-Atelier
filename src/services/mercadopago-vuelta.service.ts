import { prisma } from '@/lib/db';
import { buscarPagosDeOrden, puedeConsultarMercadoPago } from '@/services/mercadopago.service';
import { decidirVencimiento } from '@/lib/checkout/vencimiento-mp';
import { failWebPayment, finalizeWebPayment } from '@/lib/checkout/finalize-web-payment';
import { avisarCobroSinVenta } from '@/lib/checkout/aviso-cobro-sin-venta';

/**
 * La persona VOLVIÓ de Mercado Pago sin que el pago se aprobara (el botón
 * "volver al sitio", o el rechazo). Se resuelve su reserva en el momento, con
 * la misma decisión que el chequeo periódico (decidirVencimiento): se le
 * pregunta a Mercado Pago y, si no hay ningún pago, se cancela y el stock
 * vuelve; si hay uno aprobado, se acredita; si está pendiente, no se toca.
 *
 * Por qué (revisión del 10/10/2026): hasta acá la reserva quedaba 2 horas, y
 * mientras tanto la propia persona no podía reintentar: el último armazón
 * figuraba "Stock insuficiente. Disponible: 0" (lo tenía reservado ella), y en
 * los primeros 2 minutos la guarda de doble cobro le decía "Tu pedido ya fue
 * procesado", con la pantalla diciendo "Tu carrito sigue acá: podés reintentar".
 *
 * Si después igual paga en la pestaña vieja de Mercado Pago, el pago llega
 * sobre una venta cancelada por el sistema y se reactiva (finalizeWebPayment).
 */
/** 'a-revisar': Mercado Pago aprobó un pago pero la venta no lo esperaba (quedó para conciliar o estaba borrada). */
export type ResultadoVuelta = 'liberada' | 'acreditada' | 'a-revisar' | 'esperando' | 'nada';

export async function resolverVueltaSinPago(orderId: string): Promise<ResultadoVuelta> {
  const intento = await prisma.webPaymentIntent.findFirst({
    where: { orderId, status: 'PENDING', gateway: 'MERCADO_PAGO' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!intento || !puedeConsultarMercadoPago()) return 'nada';

  const decision = decidirVencimiento(await buscarPagosDeOrden(orderId));
  if (decision.accion === 'esperar') return 'esperando';
  if (decision.accion === 'acreditar') {
    const pago = decision.pago;
    const r = await finalizeWebPayment({
      intentId: intento.id,
      gatewayPaymentId: pago.id,
      gatewayStatus: pago.status,
      amount: pago.amount,
      actorName: 'Sistema (Mercado Pago)',
      paymentNote: 'Pago aprobado por Mercado Pago (confirmado al volver al sitio)',
      gatewayInstallments: pago.installments,
    });
    if (!r.ok) await avisarCobroSinVenta(pago, `al volver al sitio no se pudo acreditar: ${r.reason}`);
    return r.ok && !r.aConciliar ? 'acreditada' : 'a-revisar';
  }
  const r = await failWebPayment({
    intentId: intento.id,
    gatewayPaymentId: decision.ultimoPagoId,
    gatewayStatus: 'volvio_sin_pagar',
    motivo: 'La persona volvió de Mercado Pago sin pagar. Reserva liberada en el momento.',
  });
  return r.ok && !r.alreadyProcessed ? 'liberada' : 'nada';
}
