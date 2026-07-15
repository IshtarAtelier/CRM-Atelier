import { Metadata } from 'next';
import { getWebSettings } from '@/lib/web-settings';
import { NuestroLocalClient } from './NuestroLocalClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { getGoogleReviews } from '@/lib/googleReviews';
import { buildOpticianSchema } from '@/lib/schema';

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
  description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
  alternates: { canonical: 'https://atelieroptica.com.ar/nuestro-local' },
  openGraph: {
    title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
    description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
    type: "website",
    url: "https://atelieroptica.com.ar/nuestro-local",
    images: [
      {
        url: "/images/blog/fachada-ladrillo.webp",
        width: 1200,
        height: 630,
        alt: "Fachada de Atelier Óptica",
      }
    ]
  }
};

export default async function NuestroLocalPage() {
  const settings = await getWebSettings();

  const addressLine = settings.web_store_address;
  const localityLine = settings.web_store_locality;
  const mapsUrl = settings.web_store_maps_url;
  const phone = settings.web_store_phone;
  const whatsappPhoneId = settings.web_store_whatsapp_id;

  const reviewsData = await getGoogleReviews();

  // El builder omite aggregateRating si rating/count no son reales (> 0)
  const localBusinessJsonLd = buildOpticianSchema({
    aggregateRating: { rating: reviewsData.rating, count: reviewsData.userRatingCount },
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <NuestroLocalClient
        settings={{
          addressLine,
          localityLine,
          mapsUrl,
          phone,
          whatsappPhoneId,
        }}
        reviewCount={reviewsData.userRatingCount}
        rating={reviewsData.rating}
      >
        <StorefrontFooter />
      </NuestroLocalClient>
    </>
  );
}
