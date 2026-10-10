import type { MpPayment } from '@/services/mercadopago.service';

/**
 * Mercado Pago tiene la plata y el CRM no tiene la venta cobrada: el caso más
 * caro de la tienda. Lo usan el webhook (pago aprobado que no se pudo
 * acreditar o sin intento) y el cron que vence los pagos (rescate que no se
 * pudo acreditar). Vivía copiado dentro del webhook; un solo lugar para que
 * los dos avisen igual. Nunca lanza.
 */
export async function avisarCobroSinVenta(pago: MpPayment, porQue: string): Promise<void> {
  try {
    const { sendEmail } = await import('@/lib/email');
    const { ADMIN_ALERT_EMAILS } = await import('@/lib/constants');
    const { formatearPrecio } = await import('@/lib/format-precio');
    await sendEmail({
      to: ADMIN_ALERT_EMAILS,
      subject: '⚠️ URGENTE: cobro de Mercado Pago sin venta asociada',
      html: `<p>Mercado Pago aprobó el pago <b>${pago.id}</b> por <b>$${formatearPrecio(pago.amount)}</b>, pero ${porQue}.</p>
             <p>Pagador: ${pago.payerEmail || 'desconocido'}</p>
             <p>Hay que buscarlo en el panel de Mercado Pago y registrar o devolver la venta a mano. <b>No reponer stock automáticamente.</b></p>`,
    });
  } catch (err) {
    console.error('Error avisando cobro sin venta:', err);
  }
}
