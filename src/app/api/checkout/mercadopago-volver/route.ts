import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api-guard';
import { resolverVueltaSinPago } from '@/services/mercadopago-vuelta.service';

/**
 * POST /api/checkout/mercadopago-volver { orderId }
 *
 * La llama el checkout cuando la persona vuelve de Mercado Pago sin un pago
 * aprobado (?mp=rechazado). Pública como el resto de /api/checkout: el id de
 * la orden solo lo tiene quien vino de esa pantalla de pago, y lo único que
 * puede pasar es lo que haría el chequeo periódico más tarde, adelantado: si
 * igual paga en la pestaña vieja de Mercado Pago, la venta se reactiva
 * (ver resolverVueltaSinPago).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const limitado = enforceRateLimit(req, 'checkout-mp-volver', { limit: 10, windowMs: 10 * 60 * 1000 });
  if (limitado) return limitado;
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : '';
    if (!orderId) return NextResponse.json({ error: 'Falta la orden' }, { status: 400 });
    const resultado = await resolverVueltaSinPago(orderId);
    return NextResponse.json({ resultado });
  } catch (error) {
    // Si no se pudo preguntar a Mercado Pago, no se cancela nada: lo resuelve
    // el chequeo periódico. La persona no ve este error.
    console.error('[MP VOLVER] No se pudo resolver la vuelta sin pago:', error);
    return NextResponse.json({ resultado: 'nada' }, { status: 200 });
  }
}
