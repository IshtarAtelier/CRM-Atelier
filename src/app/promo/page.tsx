import { Metadata } from 'next';
import { PromoClient } from './PromoClient';

export const metadata: Metadata = {
  title: "Promo 2x1 en Anteojos",
  description: 'Llevate dos anteojos completos con cristales premium y pagá solo uno. Presupuestos en el acto sin compromiso.',
  alternates: {
    canonical: 'https://www.atelieroptica.com.ar/promo',
  },
};

export default function PromoPage() {
  return <PromoClient />;
}
