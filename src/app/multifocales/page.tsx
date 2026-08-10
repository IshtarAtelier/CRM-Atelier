import { Metadata } from "next";
import { notFound } from "next/navigation";

import { getGoogleReviews } from "@/lib/googleReviews";
import { getCampaign } from "@/lib/landing/campaigns";
import { getCampaignProducts } from "@/lib/landing/products";
import { precioMultifocalDesde } from "@/lib/pricing/multifocal-desde";
import { LandingClient } from "../landing/LandingClient";

/**
 * `/multifocales` — la página del producto que más factura.
 *
 * Por qué una ruta propia y no `/landing/multifocales`: esa familia de landings
 * lleva `robots: { index: false }` a propósito, para que las páginas de campaña
 * no compitan contra la home por las mismas búsquedas. Pero "multifocales" es
 * justo lo contrario — es un término que la gente TIPEA, con intención de
 * comprar, y hasta hoy ese tráfico caía en un 404 (la ruta no existía) o en la
 * home genérica. Acá se reutilizan la misma configuración y el mismo
 * componente, pero indexable y con URL canónica propia.
 * `/landing/multifocales` redirige acá para que haya UNA sola versión.
 *
 * El ancla de precio sale de la base o no sale (regla R6): si no se puede
 * calcular, la página se muestra igual, sin el número.
 */

const SLUG = "multifocales";
const URL_CANONICA = "https://atelieroptica.com.ar/multifocales";

// 5 minutos, igual que las landings: el precio "desde" tiene que poder cambiar
// sin esperar un deploy.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const campaign = getCampaign(SLUG);
  if (!campaign) return {};

  const desde = await precioMultifocalDesde();
  const description = desde
    ? `${campaign.seo.description} Cristales multifocales desde $${Math.round(desde).toLocaleString("es-AR")}.`
    : campaign.seo.description;

  return {
    title: campaign.seo.title,
    description,
    alternates: { canonical: URL_CANONICA },
    // A diferencia de /landing/*, esta SÍ se indexa: es la página del head term.
    openGraph: {
      title: campaign.seo.title,
      description,
      url: URL_CANONICA,
      type: "website",
    },
  };
}

export default async function MultifocalesPage() {
  const campaign = getCampaign(SLUG);
  if (!campaign) notFound();

  const [reviewsData, products, precioDesde] = await Promise.all([
    getGoogleReviews().catch(() => ({ userRatingCount: 0, rating: 0, reviews: [] })),
    campaign.products ?? getCampaignProducts(campaign.productCategory),
    precioMultifocalDesde(),
  ]);

  return (
    <LandingClient
      slug={campaign.slug}
      reviewCount={reviewsData.userRatingCount}
      rating={reviewsData.rating}
      reviews={reviewsData.reviews}
      products={products}
      precioDesde={precioDesde}
    />
  );
}
