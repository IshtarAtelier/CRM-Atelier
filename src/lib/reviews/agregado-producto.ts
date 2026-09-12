import { prisma } from '@/lib/db';

export type AgregadoDeResenas = {
  /** Promedio con un decimal (4.7), ya redondeado para mostrar. */
  promedio: number;
  /** Cuántas reseñas APROBADAS lo respaldan. */
  cantidad: number;
};

/**
 * Promedio y cantidad de reseñas APROBADAS de un producto.
 *
 * Una sola definición para los dos lugares que lo muestran: el bloque de
 * reseñas de la ficha (vía /api/web/reviews) y el `aggregateRating` del dato
 * estructurado que lee Google. Si cada uno lo calculara por su cuenta, podrían
 * decir cosas distintas — y un JSON-LD que declara una nota que no está escrita
 * en la página es motivo de sanción manual, no un detalle.
 *
 * Devuelve `null` cuando no hay ninguna reseña aprobada. Ese null es la regla
 * de negocio, no un caso borde: sin reseñas no se emite `aggregateRating`. Las
 * estrellas de Google se ganan con opiniones reales del producto; las reseñas
 * del NEGOCIO (las de Google Maps que se ven en la vitrina) no sirven para
 * esto: son del local, no del modelo, y usarlas como nota de un producto es
 * exactamente lo que Google sanciona.
 */
export async function agregadoDeResenas(productId: string): Promise<AgregadoDeResenas | null> {
  if (!productId) return null;
  try {
    const agg = await prisma.productReview.aggregate({
      where: { productId, approved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const cantidad = agg._count._all;
    if (!cantidad || !agg._avg.rating) return null;
    return { promedio: Math.round(agg._avg.rating * 10) / 10, cantidad };
  } catch {
    // La ficha no se cae por las reseñas: sin dato, sale sin estrellas.
    return null;
  }
}
