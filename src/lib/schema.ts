/**
 * Builders de JSON-LD (schema.org) para el storefront.
 * Todos los datos de la entidad salen de BUSINESS_INFO — no hardcodear acá.
 */

import { BUSINESS_INFO } from "./business-info";

const SITE_URL = "https://atelieroptica.com.ar";
const LOGO_URL = `${SITE_URL}/assets/logo-pwa-512.png`;

/**
 * Schema Optician completo de la entidad canónica (@id #optica).
 *
 * SIN `aggregateRating`, a propósito. Las reseñas de Atelier (5,0 · 677) las
 * junta y las muestra Google Business Profile, no este sitio: marcarlas acá es
 * exactamente lo que las guías de fragmentos de reseña llaman "self-serving"
 * —el negocio publicando su propia calificación sobre sí mismo— y expone a una
 * acción manual que se lleva puesto TODO rich result del dominio, no solo las
 * estrellas. El rating se sigue mostrando a los visitantes como texto y con
 * link al perfil de Google (ver el badge del hero y /resenas): eso es legítimo
 * y no toca el structured data.
 *
 * No agregar un parámetro para reactivarlo: la ausencia de la opción es el
 * control. Ver docs/plan-maquina-de-vender.md §2 (B7).
 */
export function buildOpticianSchema() {
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
  };
}
