import { Metadata } from "next";

import { getGoogleReviews } from "@/lib/googleReviews";
import { CAMPAIGNS } from "@/lib/landing/campaigns";
import { getCampaignProducts } from "@/lib/landing/products";
import { LandingClient } from "./LandingClient";

// Landing de conversión genérica para campañas de ads.
// Las variantes por campaña viven en /landing/[slug] (sol, multifocales, recetados).

// Render POR PEDIDO, no prerender + ISR. Estas páginas reciben tráfico PAGO y
// tienen que salir siempre con la medición (props de TrackingScripts), las
// reseñas reales y el catálogo vivo. Con ISR, tras cada deploy se servía el
// HTML del build —sin variables de entorno en Docker: sin gtag, sin pixel, con
// 0 reseñas— hasta la primera regeneración pasados 5 minutos (verificado en
// producción el 16/9/26: `x-nextjs-cache: STALE` con `gaId: $undefined`). El
// tráfico es chico (decenas por día) y el catálogo viene de la fuente
// resiliente con caché en memoria, así que el costo por pedido es mínimo; las
// reseñas siguen cacheadas 1 h por `fetch(..., { next: { revalidate } })`.
export const dynamic = "force-dynamic";

const DEFAULT = CAMPAIGNS.default;

export const metadata: Metadata = {
  title: DEFAULT.seo.title,
  description: DEFAULT.seo.description,
  alternates: { canonical: "https://atelieroptica.com.ar/landing" },
  robots: { index: false, follow: true },
  openGraph: {
    title: DEFAULT.seo.title,
    description: DEFAULT.seo.description,
    url: "https://atelieroptica.com.ar/landing",
    type: "website",
  },
};

export default async function LandingPage() {
  const [reviewsData, products] = await Promise.all([
    getGoogleReviews().catch(() => ({ userRatingCount: 0, rating: 0, reviews: [] })),
    DEFAULT.products ?? getCampaignProducts(DEFAULT.productCategory),
  ]);

  return (
    <LandingClient
      slug="default"
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      reviews={reviewsData.reviews}
      products={products}
    />
  );
}
