import { prisma } from '@/lib/db';
import { normalizeArgentinePhone } from '@/services/contact.service';

/**
 * Estados de orden que significan "el cliente YA compró / la venta está cerrada".
 * Si existe una orden en cualquiera de estos estados para la persona, NUNCA hay
 * que enviarle un email de carrito abandonado.
 *
 *  - WEB_PENDING: completó el checkout web por transferencia (orden creada, esperando comprobante)
 *  - WEB_PAID:    completó el checkout web con tarjeta (pago acreditado)
 *  - CONFIRMED:   venta confirmada en el CRM
 *  - COMPLETED:   venta cerrada / vendido
 */
// 'PENDING' es el status al que confirm-web pasa la orden tras la revisión humana
// (ver src/app/api/orders/[id]/confirm-web/route.ts) — sin él, alguien que ya
// compró y fue confirmado seguía recibiendo el email de carrito abandonado.
export const CLOSED_ORDER_STATUSES = ['WEB_PENDING', 'WEB_PAID', 'PENDING', 'CONFIRMED', 'COMPLETED'];

/**
 * Devuelve true si la persona (identificada por email o teléfono) ya tiene una
 * venta confirmada o vendida. Candado para no reenviar carrito abandonado a quien
 * ya compró.
 */
export async function hasClosedOrder(email?: string | null, phone?: string | null): Promise<boolean> {
  const normalizedPhone = phone ? normalizeArgentinePhone(phone) : null;

  const clientMatchers: any[] = [];
  if (email && email.trim()) clientMatchers.push({ email: { equals: email.trim(), mode: 'insensitive' } });
  if (normalizedPhone) clientMatchers.push({ phone: normalizedPhone });

  // Sin datos para identificar al cliente: por precaución lo tratamos como
  // "ya compró" y no enviamos.
  if (clientMatchers.length === 0) return true;

  const closed = await prisma.order.findFirst({
    where: {
      isDeleted: false,
      status: { in: CLOSED_ORDER_STATUSES },
      client: { is: { OR: clientMatchers } }
    },
    select: { id: true }
  });

  return closed !== null;
}
