import { Metadata } from 'next';
import { FaqClient } from './FaqClient';
import { FAQ_FLAT } from '@/lib/faq-data';
import { buildOpticianSchema } from '@/lib/schema';
import { BUSINESS_INFO } from '@/lib/business-info';

const SITE_URL = 'https://atelieroptica.com.ar';
const PAGE_URL = `${SITE_URL}/faq`;

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes — Anteojos, Multifocales y Envíos',
  description:
    'Respuestas sobre anteojos recetados, cristales multifocales Varilux, obras sociales, cuotas sin interés y envíos a todo el país. Óptica en Cerro de las Rosas, Córdoba.',
  keywords: [
    'preguntas frecuentes optica',
    'optica cordoba obras sociales',
    'reintegro anteojos obra social',
    'garantia multifocales varilux',
    'envio anteojos recetados argentina',
    'cuotas sin interes anteojos',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: 'Preguntas Frecuentes | Atelier Óptica Córdoba',
    description:
      'Todo lo que necesitás saber sobre nuestros anteojos, cristales, obras sociales, pagos y envíos a todo el país.',
  },
};

/** JSON-LD FAQPage generado desde la única fuente de contenido (faq-data). */
const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${PAGE_URL}#faq`,
  url: PAGE_URL,
  name: 'Preguntas Frecuentes | Atelier Óptica',
  inLanguage: 'es-AR',
  about: { '@id': BUSINESS_INFO.entityId },
  publisher: { '@id': BUSINESS_INFO.entityId },
  mainEntity: FAQ_FLAT.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Preguntas Frecuentes', item: PAGE_URL },
  ],
};

const opticianSchema = buildOpticianSchema();

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(opticianSchema) }}
      />
      <FaqClient />
    </>
  );
}
