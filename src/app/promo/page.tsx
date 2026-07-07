import { Metadata } from 'next';
import { PromoClient } from './PromoClient';

import { getGoogleReviews } from '@/lib/googleReviews';

export const metadata: Metadata = {
  title: "Promo 2x1 en Anteojos",
  description: 'Llevate dos anteojos completos con cristales premium y pagá solo uno. Presupuestos en el acto sin compromiso.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/promo',
  },
};

export default async function PromoPage() {
  const reviewsData = await getGoogleReviews();
  return <PromoClient reviewCount={reviewsData.userRatingCount} />;
}
