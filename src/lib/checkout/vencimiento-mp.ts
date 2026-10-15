import type { MpPayment } from '@/services/mercadopago.service';

/**
 * Qué hacer con un pago de Mercado Pago vencido (más de 2 h esperando),
 * según lo que Mercado Pago tiene para esa orden. Pura: sin base ni red, para
 * que la fije un chequeo (check:mp-vencimientos).
 *
 *  - un pago aprobado → acreditar (el aviso se perdió: se rescata la venta);
 *  - uno pendiente o en revisión → esperar (típico del efectivo en el kiosco);
 *  - nada, o solo rechazados/cancelados → cancelar y devolver la reserva.
 *
 * Nunca se cancela sin haber podido preguntar: quien llama, si la consulta
 * falla, no llega a llamar a esta función.
 */
export type DecisionVencimiento =
  | { accion: 'acreditar'; pago: MpPayment }
  | { accion: 'esperar' }
  | { accion: 'cancelar'; ultimoPagoId: string | null };

export function decidirVencimiento(pagos: MpPayment[]): DecisionVencimiento {
  const aprobado = pagos.find((p) => p.status === 'approved');
  if (aprobado) return { accion: 'acreditar', pago: aprobado };
  if (pagos.some((p) => p.status === 'pending' || p.status === 'in_process')) return { accion: 'esperar' };
  return { accion: 'cancelar', ultimoPagoId: pagos[0]?.id ?? null };
}
