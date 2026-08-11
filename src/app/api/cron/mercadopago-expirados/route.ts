import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPayment, isMercadoPagoEnabled } from '@/services/mercadopago.service';
import { failWebPayment, finalizeWebPayment } from '@/lib/checkout/finalize-web-payment';

/**
 * Libera los pedidos que quedaron esperando un pago de Mercado Pago que nunca
 * llegó, y rescata los que se pagaron pero cuyo aviso se perdió.
 *
 * Por qué hace falta: al elegir Mercado Pago, el pedido se crea y el stock se
 * RESERVA antes de mandar a la persona a mercadopago.com. Si cierra la pestaña
 * ahí, no hay webhook: Mercado Pago no avisa de un pago que nunca se intentó.
 * Sin esta limpieza, cada abandono se lleva un armazón del stock disponible
 * para siempre, y la tienda deja de vender mercadería que sí está en el local.
 *
 * De paso cubre el caso inverso, que es el caro: el comprador PAGÓ pero el
 * webhook se perdió (deploy justo en ese minuto, caída de red, Railway
 * reiniciando). Antes de cancelar nada, se le pregunta a Mercado Pago por cada
 * intento vencido. Si hay un pago aprobado, se acredita en vez de cancelarse.
 * Ese chequeo es la red que hace que ningún cobro quede sin venta.
 *
 * Alta del cron: GET a /api/cron/mercadopago-expirados?secret=CRON_SECRET.
 * Cada 30 minutos alcanza y sobra.
 */

export const dynamic = 'force-dynamic';

/**
 * Cuánto se espera antes de dar por perdido un intento.
 *
 * La preferencia de Mercado Pago vence a la hora (ver createPreference), así
 * que a las 2 horas ya no hay forma de que ese intento prospere. El margen
 * extra es para no cancelarle el pedido a alguien que está terminando de pagar
 * en efectivo o peleando con el homebanking.
 */
const HORAS_PARA_VENCER = 2;

/** Tope por corrida: si algo sale mal, que no se lleve puesta media base. */
const MAX_POR_CORRIDA = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET no está configurado.' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (searchParams.get('secret') !== cronSecret && token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const corte = new Date(Date.now() - HORAS_PARA_VENCER * 60 * 60 * 1000);

  const vencidos = await prisma.webPaymentIntent.findMany({
    where: { status: 'PENDING', createdAt: { lt: corte } },
    orderBy: { createdAt: 'asc' },
    take: MAX_POR_CORRIDA,
    select: { id: true, orderId: true, paymentId: true, gatewayStatus: true, createdAt: true },
  });

  if (vencidos.length === 0) {
    return NextResponse.json({ ok: true, revisados: 0, liberados: 0, rescatados: 0 });
  }

  let liberados = 0;
  let rescatados = 0;
  const errores: string[] = [];

  for (const intento of vencidos) {
    try {
      // Antes de cancelar: ¿habrá entrado la plata sin que nos enteremos?
      // Solo se puede preguntar si tenemos un id de pago (el webhook alcanzó a
      // anotarlo) y si la integración está prendida.
      if (intento.paymentId && isMercadoPagoEnabled()) {
        const pago = await getPayment(intento.paymentId);
        if (pago.status === 'approved') {
          const r = await finalizeWebPayment({
            intentId: intento.id,
            gatewayPaymentId: pago.id,
            gatewayStatus: pago.status,
            amount: pago.amount,
            actorName: 'Sistema (Mercado Pago)',
            paymentNote: 'Pago aprobado por Mercado Pago (recuperado por el chequeo periódico, el aviso no llegó)',
          });
          if (r.ok) {
            rescatados++;
            console.warn(
              `[MP CRON] ⚠️ La orden ${intento.orderId} estaba pagada y sin acreditar: el webhook no llegó. Rescatada.`,
            );
            continue;
          }
        }
        // pending / in_process: todavía puede prosperar (típico del efectivo,
        // que la persona paga en el kiosco al otro día). No se toca.
        if (pago.status === 'pending' || pago.status === 'in_process') {
          continue;
        }
      }

      const r = await failWebPayment({
        intentId: intento.id,
        gatewayStatus: 'expired',
        motivo: `Sin pago acreditado tras ${HORAS_PARA_VENCER}h. Liberado automáticamente.`,
      });
      if (r.ok && !r.alreadyProcessed) liberados++;
    } catch (err: any) {
      // Un intento que falla no puede frenar a los demás: cada uno tiene stock
      // real esperando que se libere.
      const msg = `Intento ${intento.id} (orden ${intento.orderId}): ${err?.message || err}`;
      console.error('[MP CRON]', msg);
      errores.push(msg);
      await prisma.webPaymentIntent
        .update({ where: { id: intento.id }, data: { lastError: String(err?.message || err).slice(0, 500) } })
        .catch(() => {});
    }
  }

  console.log(
    `[MP CRON] Revisados ${vencidos.length} · liberados ${liberados} · rescatados ${rescatados} · errores ${errores.length}`,
  );

  return NextResponse.json({
    ok: true,
    revisados: vencidos.length,
    liberados,
    rescatados,
    errores: errores.length ? errores : undefined,
  });
}
