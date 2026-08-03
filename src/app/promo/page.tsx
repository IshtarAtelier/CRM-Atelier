import { Metadata } from 'next';
import { PromoClient } from './PromoClient';

import { getGoogleReviews } from '@/lib/googleReviews';

export const metadata: Metadata = {
  title: "Promo 2x1 en Anteojos",
  description: 'Llevate dos anteojos completos con cristales premium y pagá solo uno. Presupuestos en el acto sin compromiso.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/promo',
  },
  // Mismo criterio que /landing/[slug]: es una página de campaña, no de
  // catálogo. Indexarla la pone a competir con el home por las mismas
  // búsquedas. Quedó sin la etiqueta cuando se separó del sistema de landings.
  robots: { index: false, follow: true },
};

export default async function PromoPage() {
  const reviewsData = await getGoogleReviews();
  return (
    <PromoClient
      reviewCount={reviewsData.userRatingCount}
      reviews={reviewsData.reviews}
    />
  );
}
