import { prisma } from '@/lib/db';
import { effectiveFramePrice } from '@/lib/checkout/checkout-pricing';
import { sePuedeVenderEnLaWeb } from '@/lib/catalog/queries';

/**
 * Precio, stock y disponibilidad de los armazones de un carrito, con las MISMAS
 * reglas con que cobra el checkout (`effectiveFramePrice` y
 * `sePuedeVenderEnLaWeb`).
 *
 * Por qué: el carrito vive en el navegador y guarda el precio del momento en
 * que se agregó. Si el armazón subía (una actualización de lista, una oferta
 * que terminó), el checkout cobraba el nuevo y rechazaba la compra con
 * "Discrepancia de precio… reintente", y reintentar no lo arreglaba nunca. Lo
 * mismo con un armazón despublicado o agotado: el carrito lo seguía mostrando
 * hasta el último paso. Con esto el carrito se pone al día solo.
 *
 * Solo minorista: el precio mayorista ya lo sincroniza useWholesaleCartBackfill.
 */
export type ArmazonAlDia = {
  id: string;
  /** Precio del armazón que cobraría el checkout hoy (oferta incluida). */
  precio: number;
  stock: number;
  /**
   * false = ya no se vende en la web (despublicado, ficha oculta, cristal,
   * inexistente). Es lo ÚNICO que saca un ítem del carrito: el stock en 0 no,
   * porque puede ser la reserva de la misma persona, que acaba de intentar
   * pagar con Mercado Pago (la reserva dura 2 h; revisión del 10/10/2026).
   */
  aLaVenta: boolean;
};

export const MAX_ARMAZONES_POR_CONSULTA = 30;

/** Ids como los acepta el checkout (mismo saneo que la ruta de pago). */
export function idsDeArmazon(crudo: string | null | undefined): string[] {
  const ids = (crudo || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[a-zA-Z0-9_-]{1,64}$/.test(id));
  return [...new Set(ids)].slice(0, MAX_ARMAZONES_POR_CONSULTA);
}

export async function armazonesAlDia(ids: string[]): Promise<ArmazonAlDia[]> {
  if (ids.length === 0) return [];
  const productos = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, price: true, salePrice: true, stock: true, publishToWeb: true, publishToWholesale: true, category: true,
      webProducts: { select: { isActive: true } },
    },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = porId.get(id);
    // Lo que no se vende en la web no informa nada más: es una ruta pública y
    // por id se podría leer el precio o el stock de un producto interno.
    if (!p || !sePuedeVenderEnLaWeb(p)) return { id, precio: 0, stock: 0, aLaVenta: false };
    return { id, precio: effectiveFramePrice(p, false), stock: p.stock ?? 0, aLaVenta: true };
  });
}
