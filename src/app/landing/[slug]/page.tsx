import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { getGoogleReviews } from "@/lib/googleReviews";
import { getCampaign, campaignSlugs } from "@/lib/landing/campaigns";
import { getCampaignProducts } from "@/lib/landing/products";
import { LandingClient } from "../LandingClient";

// Landings de conversión por campaña de ads. Cada slug (sol, multifocales,
// recetados, …) reutiliza LandingClient con su propia config.
// Coexiste con /landing/wicue (ruta estática, tiene prioridad) y /landing (índice).

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

export function generateStaticParams() {
  return campaignSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) return {};

  const url = `https://atelieroptica.com.ar/landing/${slug}`;
  return {
    title: campaign.seo.title,
    description: campaign.seo.description,
    alternates: { canonical: url },
    // No indexar landings de ads (evita competir con el home / contenido duplicado).
    robots: { index: false, follow: true },
    openGraph: {
      title: campaign.seo.title,
      description: campaign.seo.description,
      url,
      type: "website",
    },
  };
}

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // "multifocales" tiene ahora una página propia e INDEXABLE en /multifocales:
  // es un término que la gente tipea con intención de comprar, así que no puede
  // vivir bajo /landing/*, que lleva noindex a propósito. Se redirige para que
  // exista UNA sola versión de la página, y para que los anuncios que todavía
  // apunten acá terminen en la buena.
  if (slug === "multifocales") permanentRedirect("/multifocales");

  const campaign = getCampaign(slug);
  if (!campaign) notFound();

  const [reviewsData, products] = await Promise.all([
    getGoogleReviews().catch(() => ({ userRatingCount: 0, rating: 0, reviews: [] })),
    // Campañas sin catálogo web (ej. clip-on) traen productos curados en la config.
    campaign.products ?? getCampaignProducts(campaign.productCategory),
  ]);

  return (
    <LandingClient
      slug={campaign.slug}
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      reviews={reviewsData.reviews}
      products={products}
    />
  );
}
