/**
 * Builders de JSON-LD (schema.org) para el storefront.
 * Todos los datos de la entidad salen de BUSINESS_INFO — no hardcodear acá.
 */

import { BUSINESS_INFO } from "./business-info";

const SITE_URL = "https://atelieroptica.com.ar";
const LOGO_URL = `${SITE_URL}/assets/logo-pwa-512.png`;

interface OpticianSchemaOptions {
  /** Solo se emite si rating y count son reales (> 0). */
  aggregateRating?: { rating: number; count: number };
}

/** Schema Optician completo de la entidad canónica (@id #optica). */
export function buildOpticianSchema(opts: OpticianSchemaOptions = {}) {
  const { aggregateRating } = opts;
  return {
    "@context": "https://schema.org",
    "@type": "Optician",
    "@id": BUSINESS_INFO.entityId,
    name: BUSINESS_INFO.name,
    image: LOGO_URL,
    url: SITE_URL,
    telephone: BUSINESS_INFO.phoneE164,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "José Luis de Tejeda 4380",
      addressLocality: "Cerro de las Rosas, Córdoba",
      addressRegion: "Córdoba",
      postalCode: BUSINESS_INFO.postalCode,
      addressCountry: "AR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    openingHoursSpecification: BUSINESS_INFO.openingHoursSpecification,
    hasMap: BUSINESS_INFO.mapsUrl,
    sameAs: [BUSINESS_INFO.instagramUrl, BUSINESS_INFO.youtubeUrl],
    ...(aggregateRating && aggregateRating.rating > 0 && aggregateRating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: aggregateRating.rating.toFixed(1),
            bestRating: "5",
            worstRating: "1",
            reviewCount: aggregateRating.count.toString(),
          },
        }
      : {}),
  };
}
