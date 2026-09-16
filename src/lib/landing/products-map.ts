/**
 * Elige y da forma a los productos que muestra una landing de campaña, a partir
 * de las filas del catálogo de la tienda (las mismas que ve /tienda).
 *
 * Es una función PURA a propósito: la lectura (viva → memoria → snapshot) la
 * hace `getTiendaCatalogo()`; acá solo se filtra y se mapea, así el check
 * `npm run check:landing` puede correrla contra el snapshot commiteado sin base.
 *
 * Por qué existe: hasta el 15/9/2026 la landing tenía una lista inventada de
 * respaldo —"Rosé Cat Eye", "Pantos Blush", "Mistral Manglares", fotos que no
 * eran del catálogo y sin precio— que salía cada vez que la consulta a la base
 * fallaba o el build no tenía base, y con ISR quedaba cacheada 5 minutos para
 * todos. Ishtar la vio en producción en todas las landings. Un anuncio pago que
 * aterriza en armazones que no existen es peor que una landing sin productos.
 * Ahora el piso es el snapshot del catálogo real: nombres, fotos y precios de
 * verdad, como en el resto de la tienda.
 */

import { PricingService } from "@/services/PricingService";
import { BUSINESS_INFO } from "@/lib/business-info";
import { precioFinal } from "@/lib/precio-oferta";
import { resolveStorageUrl } from "@/lib/utils/storage";
import type { LandingProduct } from "./campaigns";

/** Lo que hace falta de una fila del catálogo (subconjunto de TIENDA_SELECT). */
export interface FilaCatalogoLanding {
  name: string;
  slug: string;
  category?: string | null;
  isFeatured?: boolean | null;
  images?: string[] | null;
  product?: {
    price?: number | null;
    salePrice?: number | null;
    imagenesCatalogo?: string[] | null;
  } | null;
}

const MAXIMO = 8;
/** Con menos que esto la grilla queda rala; se amplía a todo el catálogo. */
const MINIMO_DESEADO = 4;

/** Texto de precio de la tarjeta, con la misma regla que toda la vidriera. */
export function textoPrecioLanding(fila: FilaCatalogoLanding): string {
  const precio = precioFinal(fila.product);
  if (!precio) return "";
  // El precio protagonista es el de transferencia; la cuota va como dato de
  // pago. Los montos salen de PricingService, nada dividido a mano (Ishtar, 31/8).
  const v = PricingService.preciosVidriera(precio, BUSINESS_INFO.discountCashPercent);
  return `$${v.contado.toLocaleString("es-AR")} por transferencia · 6 cuotas sin interés de $${v.cuota6.toLocaleString("es-AR")}`;
}

function imagenDe(fila: FilaCatalogoLanding): string {
  const propias = fila.images ?? [];
  const catalogo = fila.product?.imagenesCatalogo ?? [];
  if (propias.length > 0) return resolveStorageUrl(propias[0]);
  if (catalogo.length > 0) return resolveStorageUrl(catalogo[0]);
  return "/images/og-image.jpg";
}

/**
 * @param category  Filtro `contains` sin distinguir mayúsculas (ej. "Receta").
 *                  null = los destacados, sin filtrar.
 * Si el filtro deja menos de MINIMO_DESEADO, se amplía a todo el catálogo
 * (destacados primero). Nunca inventa nada: devuelve vacío solo si el catálogo
 * está vacío, y eso el snapshot lo impide.
 */
export function seleccionarProductosLanding(
  catalogo: FilaCatalogoLanding[],
  category: string | null,
): LandingProduct[] {
  const validas = catalogo.filter((f) => f && f.product && f.name && f.slug);
  const destacadosPrimero = (a: FilaCatalogoLanding, b: FilaCatalogoLanding) =>
    Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));

  let elegidas = category
    ? validas.filter((f) => (f.category || "").toLowerCase().includes(category.toLowerCase()))
    : validas.filter((f) => Boolean(f.isFeatured));
  if (elegidas.length < MINIMO_DESEADO) elegidas = validas;

  return [...elegidas]
    .sort(destacadosPrimero)
    .slice(0, MAXIMO)
    .map((f) => ({
      name: f.name,
      price: textoPrecioLanding(f),
      img: imagenDe(f),
      slug: f.slug,
    }));
}
