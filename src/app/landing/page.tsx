import { Metadata } from "next";

import { getGoogleReviews } from "@/lib/googleReviews";
import { CAMPAIGNS } from "@/lib/landing/campaigns";
import { getCampaignProducts } from "@/lib/landing/products";
import { LandingClient } from "./LandingClient";

// Landing de conversión genérica para campañas de ads.
// Las variantes por campaña viven en /landing/[slug] (sol, multifocales, recetados).

export const revalidate = 300;

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
    getGoogleReviews().catch(() => ({ userRatingCount: 0, rating: 0 })),
    DEFAULT.products ?? getCampaignProducts(DEFAULT.productCategory),
  ]);

  return (
    <LandingClient
      slug="default"
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      products={products}
    />
  );
}
