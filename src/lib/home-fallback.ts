// ────────────────────────────────────────────────────────────────────────────
// Tipos y formato PUROS del carrusel del home (sin prisma, sin I/O).
//
// La resiliencia (vivo → memoria → snapshot) vive en src/lib/catalog/
// (resilience.ts + sources.ts); acá solo el shape de las filas y el formateo
// del carrusel, para poder fijarlos con `npm run check:catalog` sin base.
//
// SIN imports a propósito: el check lo ejecuta Node pelado (--experimental-strip-types),
// que no resuelve el alias "@/". El resolvedor de URLs se inyecta por parámetro.
// ────────────────────────────────────────────────────────────────────────────

type ResolveUrl = (urlOrKey: string | null | undefined) => string;

/** Fila cruda de WebProduct tal como la selecciona el home (PRODUCT_SELECT). */
export interface HomeWebProductRow {
  name: string;
  imageUrl: string | null;
  images: string[];
  slug: string;
  product: {
    id: string;
    price: number | null;
    stock: number | null;
    model: string | null;
    category: string | null;
    imagenesCatalogo: string[];
  };
}

/** Conjunto de colecciones que alimentan el carrusel del home. */
export interface HomeSourceData {
  destacados: HomeWebProductRow[];
  sol: HomeWebProductRow[];
  receta: HomeWebProductRow[];
  nuevos: HomeWebProductRow[];
  count: number;
}

export function countProducts(data: HomeSourceData | null | undefined): number {
  if (!data) return 0;
  return (
    (data.destacados?.length || 0) +
    (data.sol?.length || 0) +
    (data.receta?.length || 0) +
    (data.nuevos?.length || 0)
  );
}

export function hasProducts(data: HomeSourceData | null | undefined): boolean {
  return countProducts(data) > 0;
}

/** Producto ya formateado para el carrusel del home. */
export interface CarouselProduct {
  id: string;
  name: string;
  rawPrice: number | null;
  price: string;
  img: string;
  slug: string;
  stock: number | null;
  brand: string;
  model: string | null;
  secondImg: string | null;
  category: string | null;
}

/**
 * Formatea las filas crudas para el carrusel y deduplica variantes de color
 * (p. ej. "Frida C1" y "Frida C5" → solo la primera). Movido tal cual desde
 * src/app/page.tsx para poder fijarlo con checks. `resolveUrl` es
 * resolveStorageUrl inyectado (ver nota de imports arriba).
 */
export function formatProducts(
  list: HomeWebProductRow[] | null | undefined,
  resolveUrl: ResolveUrl,
): CarouselProduct[] {
  if (!list || list.length === 0) return [];

  const formatted = list.map((wp) => ({
    id: wp.product.id,
    name: wp.name,
    rawPrice: wp.product.price,
    price: wp.product.price ? `6 cuotas de $${Math.round(wp.product.price / 6).toLocaleString("es-AR")}` : "",
    img: wp.imageUrl
      ? resolveUrl(wp.imageUrl)
      : (wp.images.length > 0
          ? resolveUrl(wp.images[0])
          : (wp.product.imagenesCatalogo.length > 0 ? resolveUrl(wp.product.imagenesCatalogo[0]) : "/images/og-image.jpg")),
    slug: wp.slug,
    stock: wp.product.stock,
    brand: "ATELIER",
    model: wp.product.model,
    secondImg: wp.images.length > 1
      ? resolveUrl(wp.images[1])
      : (wp.product.imagenesCatalogo.length > 1 ? resolveUrl(wp.product.imagenesCatalogo[1]) : null),
    category: wp.product.category,
  }));

  // Deduplicate variants (e.g. "Frida C1" and "Frida C5" -> only keep first)
  const uniqueBaseNames = new Set<string>();
  const deduplicated = formatted.filter((p) => {
    const match = (p.model || p.name).match(/(.*)\s+(c\d+)\b/i);
    const baseName = match ? match[1].trim().toLowerCase() : (p.model || p.name).toLowerCase();

    if (uniqueBaseNames.has(baseName)) return false;
    uniqueBaseNames.add(baseName);
    return true;
  });

  return deduplicated.slice(0, 12);
}
