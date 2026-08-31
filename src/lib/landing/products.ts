import { prisma } from "@/lib/db";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { PricingService } from "@/services/PricingService";
import { BUSINESS_INFO } from "@/lib/business-info";
import type { LandingProduct } from "./campaigns";

// Fallback si la DB no responde: una landing de ads nunca debe quedar vacía
// ni romper. SIN PRECIOS a propósito — acá había montos congelados a mano
// ("6 cuotas de $9.167") de una lista vieja: publicar un precio vencido es
// peor que no publicar ninguno (auditoría 31/8; misma regla R6 de social).
const FALLBACK_PRODUCTS: LandingProduct[] = [
  { name: "Atelier 9030", price: "", img: "/images/products/atelier-9030-gold.png", slug: "" },
  { name: "Rosé Cat Eye", price: "", img: "/images/products/cateye-rose.png", slug: "" },
  { name: "Pantos Blush", price: "", img: "/images/products/pantos-pink.png", slug: "" },
  { name: "Mistral Manglares", price: "", img: "/images/products/mistral-manglares.png", slug: "" },
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

    // Se arma fila por fila: si una sola tiene datos legados incompletos (imágenes
    // null, relación de producto rota) se descarta ESA fila, no el batch entero.
    const formatted: LandingProduct[] = [];
    for (const wp of rows) {
      try {
        if (!wp.product) continue;
        const images = wp.images ?? [];
        const catalogImages = wp.product.imagenesCatalogo ?? [];
        formatted.push({
          name: wp.name,
          // Mismo criterio que toda la vidriera (Ishtar, 31/8): el precio
          // protagonista es el de transferencia; la cuota va como dato de
          // pago. Los montos salen de PricingService, nada dividido a mano.
          price: wp.product.price
            ? (() => {
                const v = PricingService.preciosVidriera(wp.product.price, BUSINESS_INFO.discountCashPercent);
                return `$${v.contado.toLocaleString("es-AR")} por transferencia · 6 cuotas sin interés de $${v.cuota6.toLocaleString("es-AR")}`;
              })()
            : "",
          img: wp.imageUrl
            ? resolveStorageUrl(wp.imageUrl)
            : images.length > 0
              ? resolveStorageUrl(images[0])
              : catalogImages.length > 0
                ? resolveStorageUrl(catalogImages[0])
                : "/images/og-image.jpg",
          slug: wp.slug,
        });
      } catch (rowError) {
        console.error("[Landing] fila de producto descartada:", wp.slug, rowError);
      }
    }

    return formatted.length >= 4 ? formatted.slice(0, 8) : FALLBACK_PRODUCTS;
  } catch (error) {
    console.error("[Landing] getCampaignProducts failed:", error);
    return FALLBACK_PRODUCTS;
  }
}
