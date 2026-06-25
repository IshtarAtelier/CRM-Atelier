import { Metadata } from 'next';
import { getWebSettings } from '@/lib/web-settings';
import { NuestroLocalClient } from './NuestroLocalClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';

export const metadata: Metadata = {
  title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
  description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
  alternates: { canonical: 'https://www.atelieroptica.com.ar/nuestro-local' },
  openGraph: {
    title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
    description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
    type: "website",
    url: "https://www.atelieroptica.com.ar/nuestro-local",
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

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': 'Atelier Óptica',
    'image': 'https://www.atelieroptica.com.ar/images/og-image.jpg',
    '@id': mapsUrl,
    'url': 'https://www.atelieroptica.com.ar',
    'telephone': phone,
    'priceRange': '$$',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': addressLine,
      'addressLocality': localityLine,
      'addressRegion': 'Córdoba',
      'postalCode': '5009',
      'addressCountry': 'AR',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': -31.3831,
      'longitude': -64.24005,
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '09:30',
        'closes': '13:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '16:30',
        'closes': '20:30',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Saturday'],
        'opens': '09:30',
        'closes': '13:00',
      }
    ],
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '5.0',
      'bestRating': '5',
      'worstRating': '1',
      'ratingCount': '89',
    }
  };

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
      >
        <StorefrontFooter />
      </NuestroLocalClient>
    </>
  );
}
