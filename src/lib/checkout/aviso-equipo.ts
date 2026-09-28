import { prisma } from '@/lib/db';
import { formatearPrecio } from '@/lib/format-precio';
import { telefonoLegible } from '@/lib/phone-utils';
import { CRM_ORIGIN } from '@/lib/constants';
import { InternalMessagingService } from '@/services/internal-messaging.service';
import { SIN_ROBOTS } from '@/lib/checkout/robots';

/**
 * Aviso al equipo por la mensajería interna cuando una PERSONA dejó sus datos
 * en el checkout de la web y no pagó (Ishtar 28/9/2026: "alertarme ... para no
 * perder esa gente").
 *
 * Hasta acá el carrito solo aparecía en Oportunidades de Cierre: si nadie abría
 * el panel, nadie se enteraba. El recupero automático es por mail; el WhatsApp
 * lo tiene que mandar una persona, y para eso tiene que saber que existe.
 *
 * Una vez por carrito: la marca `[carrito:<id>]` va en el cuerpo y se busca sin
 * ventana de tiempo, así un carrito de la noche que se avisa a las 9 no se
 * repite a las 10 ni al día siguiente. El robot de Google nunca entra.
 */
const ABIERTOS = ['PENDING', 'EMAIL_SENT', 'ABANDONED'];
/** Minutos sin tocar el carrito para considerarlo abandonado. */
const MINUTOS_SIN_ACTIVIDAD = 45;
/** No avisar carritos de más de 3 días: ya no se recuperan. */
const DIAS_MAXIMOS = 3;

type ItemCarrito = { brand?: string; model?: string; name?: string };

function describirCarrito(cartData: unknown): string {
  const items = Array.isArray(cartData) ? (cartData as ItemCarrito[]) : [];
  const nombres = items.map((i) => [i.brand, i.model].filter(Boolean).join(' ') || i.name).filter(Boolean);
  return nombres.length ? nombres.join(', ') : 'productos de la tienda';
}

export async function avisarCarritosAbandonados(ahora = new Date()): Promise<{ avisados: number }> {
  const desde = new Date(ahora.getTime() - DIAS_MAXIMOS * 24 * 60 * 60 * 1000);
  const hasta = new Date(ahora.getTime() - MINUTOS_SIN_ACTIVIDAD * 60 * 1000);

  const carritos = await prisma.checkoutSession.findMany({
    where: {
      status: { in: ABIERTOS },
      updatedAt: { gte: desde, lte: hasta },
      OR: [{ phone: { not: null, notIn: [''] } }, { email: { not: null, notIn: [''] } }],
      ...SIN_ROBOTS,
    },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, total: true, cartData: true },
    take: 20,
  });
  if (!carritos.length) return { avisados: 0 };

  const equipo = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'STAFF'] } }, select: { id: true } });
  let avisados = 0;

  for (const c of carritos) {
    const marca = `[carrito:${c.id}]`;
    const yaAvisado = await prisma.internalMessage.findFirst({ where: { body: { contains: marca } }, select: { id: true } });
    if (yaAvisado) continue;

    const nombre = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';
    const contacto = [c.phone ? `📱 ${telefonoLegible(c.phone)}` : '', c.email ? `✉️ ${c.email}` : ''].filter(Boolean).join(' · ');
    const cuerpo =
      `🛒 Carrito abandonado en la web\n` +
      `${nombre} · ${contacto}\n` +
      `Quería: ${describirCarrito(c.cartData)} · $${formatearPrecio(c.total || 0)}\n` +
      `Dejó sus datos y no pagó. Escribile por WhatsApp desde Oportunidades de Cierre: ${CRM_ORIGIN}/admin\n` +
      `Ref. ${marca}`;

    for (const u of equipo) {
      try {
        await InternalMessagingService.mensajeDeIA({ paraUserId: u.id, cuerpo, asunto: 'Carrito abandonado en la web' });
      } catch (err) {
        console.error(`[Aviso carrito] No se pudo avisar a ${u.id}:`, err);
      }
    }
    avisados++;
  }
  return { avisados };
}
