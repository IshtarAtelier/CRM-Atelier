/**
 * Prueba social REAL de la tienda: cuántos clientes distintos compraron cada
 * producto y cada marca. Todo sale de órdenes reales de la base — nada se
 * estima ni se infla (Ley 24.240; ver constants/social-proof.ts).
 *
 * Qué cuenta como "venta real" acá: una orden tipo SALE, no borrada, que además
 * esté respaldada por al menos un pago registrado (fila de Payment) o por haber
 * pasado por laboratorio (labStatus distinto de NONE) sin quedar como compra
 * web pendiente de procesar. Es la regla del proyecto: `Order.paid` NO prueba
 * cobro, la venta real se mide por Payment o labStatus (CLAUDE.md). Los
 * presupuestos (QUOTE) y el canal mayorista quedan afuera: esto habla de
 * clientes finales que compraron de verdad.
 *
 * El resultado ya viene FILTRADO por los umbrales: un conteo por debajo del
 * umbral directamente no viaja al navegador. Así el endpoint público no revela
 * ventas producto por producto (dato comercial) y el cliente no puede mostrar
 * un cartel que no corresponde.
 *
 * Cacheado 1 hora en memoria: los conteos cambian de a una venta por vez y la
 * tienda no puede pegarle a la base en cada pageview.
 */

import { prisma } from "@/lib/db";
import { serverCache } from "@/lib/cache";
import {
  UMBRAL_ELEGIDO_PRODUCTO,
  UMBRAL_ELEGIDO_MARCA,
  claveMarca,
} from "@/lib/constants/social-proof";

export interface SocialProof {
  /** productId → clientes DISTINTOS que lo compraron. Solo entradas >= UMBRAL_ELEGIDO_PRODUCTO. */
  productos: Record<string, number>;
  /** marca normalizada (claveMarca) → clientes distintos. Solo entradas >= UMBRAL_ELEGIDO_MARCA. */
  marcas: Record<string, number>;
}

const CACHE_KEY = "social-proof:conteos";
const CACHE_TTL_SECONDS = 3600;

const VACIO: SocialProof = { productos: {}, marcas: {} };

/**
 * Nunca lanza: ante cualquier falla devuelve mapas vacíos y la tienda
 * simplemente no muestra carteles (que es exactamente lo que corresponde
 * cuando no hay dato verificable).
 */
export async function getSocialProof(): Promise<SocialProof> {
  const cached = serverCache.get<SocialProof>(CACHE_KEY);
  if (cached !== null) return cached;

  try {
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          isDeleted: false,
          orderType: "SALE",
          OR: [
            // Pago registrado de verdad…
            { payments: { some: {} } },
            // …o pasó por laboratorio y no es una compra web sin procesar
            // (las web nacen con labStatus SENT antes de confirmarse el pago).
            {
              labStatus: { not: "NONE" },
              status: { not: "WEB_PENDING" },
            },
          ],
        },
      },
      select: {
        productId: true,
        productBrandSnapshot: true,
        order: { select: { clientId: true } },
        product: { select: { brand: true } },
      },
    });

    // En los dos niveles se cuentan CLIENTES distintos, no tickets: el cartel
    // dice "clientes", así que un cliente que compró dos veces vale uno. La
    // marca sale del producto vinculado si existe; si no, del snapshot que
    // tipeó el vendedor.
    const clientesPorProducto = new Map<string, Set<string>>();
    const clientesPorMarca = new Map<string, Set<string>>();

    for (const item of items) {
      if (item.productId) {
        let set = clientesPorProducto.get(item.productId);
        if (!set) clientesPorProducto.set(item.productId, (set = new Set()));
        set.add(item.order.clientId);
      }
      const marca = claveMarca(item.product?.brand ?? item.productBrandSnapshot);
      if (marca) {
        let set = clientesPorMarca.get(marca);
        if (!set) clientesPorMarca.set(marca, (set = new Set()));
        set.add(item.order.clientId);
      }
    }

    const resultado: SocialProof = { productos: {}, marcas: {} };
    for (const [productId, clientes] of clientesPorProducto) {
      if (clientes.size >= UMBRAL_ELEGIDO_PRODUCTO) {
        resultado.productos[productId] = clientes.size;
      }
    }
    for (const [marca, clientes] of clientesPorMarca) {
      if (clientes.size >= UMBRAL_ELEGIDO_MARCA) {
        resultado.marcas[marca] = clientes.size;
      }
    }

    serverCache.set(CACHE_KEY, resultado, CACHE_TTL_SECONDS);
    return resultado;
  } catch (error) {
    console.error("Error calculando prueba social:", error);
    // Sin caché: la próxima request reintenta contra la base.
    return VACIO;
  }
}
