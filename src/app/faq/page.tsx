import { Metadata } from 'next';
import { FaqClient } from './FaqClient';

export const metadata: Metadata = {
  title: "Preguntas Frecuentes",
  description: 'Resolvemos tus dudas principales sobre envíos, medios de pago y garantías.',
  alternates: {
    canonical: 'https://atelieroptica.com.ar/faq',
  },
};

export default function FAQPage() {
  return <FaqClient />;
}
