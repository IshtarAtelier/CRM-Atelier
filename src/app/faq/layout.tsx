import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes | Atelier Óptica Córdoba',
  description: 'Respuestas a las preguntas más frecuentes sobre anteojos de receta, multifocales, lentes de sol y servicios de Atelier Óptica en Córdoba.',
  alternates: { canonical: 'https://www.atelieroptica.com.ar/faq' },
  openGraph: {
    title: 'Preguntas Frecuentes | Atelier Óptica Córdoba',
    description: 'Respuestas a las preguntas más frecuentes sobre anteojos de receta, multifocales, lentes de sol y servicios de Atelier Óptica en Córdoba.',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': '¿Hacen envíos a todo el país?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Sí, realizamos envíos a toda Argentina a través de Correo Argentino o Andreani. Los envíos superando cierto monto son bonificados.',
      },
    },
    {
      '@type': 'Question',
      'name': '¿Trabajan con obras sociales?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Trabajamos con reintegros. Te entregamos la factura oficial y todos los comprobantes necesarios para que puedas presentar el trámite en tu obra social o prepaga.',
      },
    },
    {
      '@type': 'Question',
      'name': '¿Tienen garantía los cristales multifocales?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Absolutamente. Todos nuestros cristales multifocales (Varilux, Novar, Zeiss) cuentan con garantía de adaptación. Si no te adaptás en los primeros 30 días, te cambiamos los cristales sin costo (es requisito presentar una nueva receta emitida por tu oftalmólogo).',
      },
    },
    {
      '@type': 'Question',
      'name': '¿Puedo probarme los anteojos antes de comprarlos?',
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': 'Si estás en Córdoba, te invitamos a nuestro local en Cerro de las Rosas para que te pruebes todo el catálogo. Si estás en otra provincia, podés usar nuestra herramienta de Virtual Try-On en la Tienda.',
      },
    },
  ],
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
