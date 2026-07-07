import { Metadata } from "next";
import { notFound } from "next/navigation";

import { getGoogleReviews } from "@/lib/googleReviews";
import { getCampaign, campaignSlugs } from "@/lib/landing/campaigns";
import { getCampaignProducts } from "@/lib/landing/products";
import { LandingClient } from "../LandingClient";

// Landings de conversión por campaña de ads. Cada slug (sol, multifocales,
// recetados, …) reutiliza LandingClient con su propia config.
// Coexiste con /landing/wicue (ruta estática, tiene prioridad) y /landing (índice).

export const revalidate = 300;

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
  const campaign = getCampaign(slug);
  if (!campaign) notFound();

  const [reviewsData, products] = await Promise.all([
    getGoogleReviews().catch(() => ({ userRatingCount: 642, rating: 5.0 })),
    // Campañas sin catálogo web (ej. clip-on) traen productos curados en la config.
    campaign.products ?? getCampaignProducts(campaign.productCategory),
  ]);

  return (
    <LandingClient
      slug={campaign.slug}
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      products={products}
    />
  );
}
