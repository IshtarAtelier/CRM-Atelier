import { Metadata } from "next";

import { prisma } from "@/lib/db";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { getGoogleReviews } from "@/lib/googleReviews";
import { LandingClient, type LandingProduct } from "./LandingClient";

// Landing de conversión para campañas de ads.
// Reutiliza la estética e imágenes del home (retratos editoriales + productos
// destacados reales) pero con una estructura pensada para generar leads por WhatsApp.

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Atelier Óptica | Anteojos de Autor con Cristales Premium en Cuotas",
  description:
    "Anteojos de diseño con cristales premium y multifocales Varilux. Asesoramiento personalizado por WhatsApp, cuotas sin interés y envíos a todo el país. Presupuesto en el acto.",
  alternates: {
    canonical: "https://www.atelieroptica.com.ar/landing",
  },
  // Las landings de ads no deben indexarse (evita competir con el home en SEO
  // y duplicar contenido). Se acceden por el enlace del anuncio.
  robots: { index: false, follow: true },
  openGraph: {
    title: "Atelier Óptica | Anteojos de Autor con Cristales Premium",
    description:
      "Diseño de autor, cristales premium y asesoramiento por WhatsApp. Cuotas sin interés y envíos a todo el país.",
    url: "https://www.atelieroptica.com.ar/landing",
    type: "website",
  },
};

// Imágenes/productos del home como fallback si la DB no responde
// (una landing de ads nunca debe quedar vacía ni romper).
const FALLBACK_PRODUCTS: LandingProduct[] = [
  { name: "Atelier 9030", price: "6 cuotas de $9.167", img: "/images/products/atelier-9030-gold.png", slug: "" },
  { name: "Rosé Cat Eye", price: "6 cuotas de $8.000", img: "/images/products/cateye-rose.png", slug: "" },
  { name: "Pantos Blush", price: "6 cuotas de $7.500", img: "/images/products/pantos-pink.png", slug: "" },
  { name: "Mistral Manglares", price: "6 cuotas de $8.667", img: "/images/products/mistral-manglares.png", slug: "" },
];

async function getFeaturedProducts(): Promise<LandingProduct[]> {
  try {
    const rows = await prisma.webProduct.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        product: { publishToWeb: true, category: { not: "Cristal" } },
      },
      select: {
        name: true,
        imageUrl: true,
        images: true,
        slug: true,
        product: { select: { price: true, imagenesCatalogo: true } },
      },
      orderBy: { createdAt: "desc" },
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
    console.error("[Landing] featured products query failed:", error);
    return FALLBACK_PRODUCTS;
  }
}

export default async function LandingPage() {
  const [reviewsData, products] = await Promise.all([
    getGoogleReviews().catch(() => ({ userRatingCount: 642, rating: 5.0 })),
    getFeaturedProducts(),
  ]);

  return (
    <LandingClient
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      products={products}
    />
  );
}
