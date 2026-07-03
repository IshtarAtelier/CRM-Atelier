import { prisma } from "@/lib/db";
import { resolveStorageUrl } from "@/lib/utils/storage";
import type { LandingProduct } from "./campaigns";

// Productos del home como fallback: una landing de ads nunca debe quedar vacía
// ni romper si la DB no responde.
const FALLBACK_PRODUCTS: LandingProduct[] = [
  { name: "Atelier 9030", price: "6 cuotas de $9.167", img: "/images/products/atelier-9030-gold.png", slug: "" },
  { name: "Rosé Cat Eye", price: "6 cuotas de $8.000", img: "/images/products/cateye-rose.png", slug: "" },
  { name: "Pantos Blush", price: "6 cuotas de $7.500", img: "/images/products/pantos-pink.png", slug: "" },
  { name: "Mistral Manglares", price: "6 cuotas de $8.667", img: "/images/products/mistral-manglares.png", slug: "" },
];

/**
 * Trae productos destacados para una landing de campaña.
 * @param category  Filtro `contains` case-insensitive (ej. "Sol", "Receta"). null = destacados sin filtrar.
 * Prioriza los `isFeatured`. Cae al fallback si la query falla o devuelve pocos resultados.
 */
export async function getCampaignProducts(
  category: string | null,
): Promise<LandingProduct[]> {
  try {
    const rows = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        ...(category
          ? { category: { contains: category, mode: "insensitive" } }
          : { isFeatured: true }),
        product: { publishToWeb: true, category: { not: "Cristal" } },
      },
      select: {
        name: true,
        imageUrl: true,
        images: true,
        slug: true,
        product: { select: { price: true, imagenesCatalogo: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 8,
    });

    const formatted: LandingProduct[] = rows.map((wp) => ({
      name: wp.name,
      price: wp.product.price
        ? `6 cuotas de $${Math.round(wp.product.price / 6).toLocaleString("es-AR")}`
        : "",
      img: wp.imageUrl
        ? resolveStorageUrl(wp.imageUrl)
        : wp.images.length > 0
          ? resolveStorageUrl(wp.images[0])
          : wp.product.imagenesCatalogo.length > 0
            ? resolveStorageUrl(wp.product.imagenesCatalogo[0])
            : "/images/og-image.jpg",
      slug: wp.slug,
    }));

    return formatted.length >= 4 ? formatted.slice(0, 8) : FALLBACK_PRODUCTS;
  } catch (error) {
    console.error("[Landing] getCampaignProducts failed:", error);
    return FALLBACK_PRODUCTS;
  }
}
