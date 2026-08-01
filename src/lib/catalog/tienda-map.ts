// ────────────────────────────────────────────────────────────────────────────
// Mapeo del catálogo web (filas crudas → producto de grilla) COMPARTIDO entre
// /tienda (SSR) y /api/store/products (paginación/filtros del cliente).
//
// Antes vivía duplicado en ambos lados ("réplica exacta" mantenida a mano);
// ahora es una sola función sobre la fuente resiliente getTiendaCatalogo(), con
// el mismo serverCache de 180s de siempre para no rebajar el catálogo entero de
// la DB en cada cambio de filtro. El fallback NO se cachea: mientras se sirve
// degradado, cada request reintenta la DB (auto-recuperación inmediata).
// ────────────────────────────────────────────────────────────────────────────

import { serverCache } from "@/lib/cache";
import { getProductAttributes } from "@/utils/product-controllers";
import { getTiendaCatalogo, type CatalogRow } from "@/lib/catalog/sources";
import { parseFrameSpecs, pickDescriptiveAlt } from "@/lib/catalog/frame-specs";
import type { CatalogOrigin } from "@/lib/catalog/resilience";

export interface MappedWebProduct {
  id: string;
  brand: string;
  model: string;
  modelCode: string;
  category: string | null;
  price: number | null;
  salePrice: number | null;
  stock: number | null;
  slug: string;
  imagenesCatalogo: string[];
  shape: string;
  material: string;
  /**
   * Color del armazón, sacado del alt de la foto. Puede ser null: se prefiere
   * un dato ausente a uno inventado, porque en el feed de Merchant Center un
   * atributo equivocado es motivo de desaprobación del producto.
   */
  color: string | null;
  gender: string;
  /** Campos que solo consume el feed de Google/Meta, no la grilla. */
  mpn: string | null;
  ageGroup: string | null;
  description: string | null;
}

const CACHE_KEY = "store-products-mapped:web";
const CACHE_TTL_SECONDS = 180;

function mapRow(wp: CatalogRow): MappedWebProduct {
  const modelCode = wp.product.model || wp.name || "";
  const { shape, material } = getProductAttributes(modelCode, wp.product.seoTags);

  // El color sale del alt de la foto, que es texto escrito a mano y explícito.
  // El material del alt le gana al de getProductAttributes(), que cuando no
  // reconoce el modelo devuelve "Metal" por descarte — en el feed eso sería
  // afirmar un material que quizá no es.
  const specs = parseFrameSpecs(pickDescriptiveAlt(wp.imageAlts));

  const isXl = ["9004M C3", "9004M C2", "TL3684 C4", "91501 C6"].some((code) => modelCode.toUpperCase().includes(code)) ||
               ["dionisio", "dionisio-c2", "selene-c4", "atelier-athena-3ytl", "poseidon-c3", "poseidon-c2"].includes(wp.slug);

  return {
    id: wp.product.id,
    brand: wp.product.brand || "ATELIER",
    model: wp.name || modelCode, // WebProduct.name manda sobre Product.model
    modelCode,
    category: wp.category,
    price: wp.product.price,
    salePrice: wp.product.salePrice,
    stock: wp.product.stock,
    slug: wp.slug,
    // La grilla solo usa [0] (principal) y [1] (hover). Recortamos a 2 para no
    // arrastrar el resto de Data URIs base64 (peso muerto ×24).
    imagenesCatalogo: (wp.images.length > 0 ? wp.images : (wp.product.imagenesCatalogo || [])).slice(0, 2),
    shape: isXl ? "XL" : (shape || "Otros"),
    // El alt manda; getProductAttributes() queda de respaldo para las filas
    // que no tengan alt descriptivo (o cuando sirve el snapshot de emergencia,
    // que no incluye imageAlts).
    material: specs.material || material || "Acetato",
    color: specs.color,
    gender: wp.product.gender || "Unisex",
    mpn: wp.product.mpn || null,
    ageGroup: wp.product.ageGroup || null,
    description: wp.product.seoDescription || null,
  };
}

/**
 * Catálogo web mapeado, con caché de 180s y fallback resiliente por debajo.
 * Nunca lanza y nunca devuelve vacío (mientras el snapshot tenga productos).
 */
export async function getMappedWebCatalog(): Promise<{ products: MappedWebProduct[]; origin: CatalogOrigin | "cache" }> {
  const cached = serverCache.get<MappedWebProduct[]>(CACHE_KEY);
  if (cached !== null) {
    return { products: cached, origin: "cache" };
  }

  const { data, origin } = await getTiendaCatalogo();
  const products = data.map(mapRow);

  // Solo cachear lecturas vivas: un fallback cacheado taparía la recuperación
  // de la DB durante 180s.
  if (origin === "live") {
    serverCache.set(CACHE_KEY, products, CACHE_TTL_SECONDS);
  }
  return { products, origin };
}
