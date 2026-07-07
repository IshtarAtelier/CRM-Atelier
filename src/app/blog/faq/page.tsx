import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, ChevronDown } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { WHATSAPP_PHONE } from '@/lib/constants';
export const metadata: Metadata = {
  title: "Preguntas Frecuentes sobre Salud Visual | Atelier Óptica",
  description: "Respuestas de expertos a las dudas más comunes sobre miopía infantil (Stellest, Myopilux), lentes con filtro azul, anteojos inteligentes Meta Ray-Ban y adaptación a multifocales.",
  alternates: { canonical: 'https://atelieroptica.com.ar/blog/faq' },
  openGraph: {
    title: "Preguntas Frecuentes sobre Salud Visual | Atelier Óptica",
    description: "Resolvé todas tus dudas sobre cristales especiales, control de miopía infantil, tecnología Blue Block y Smart Glasses con nuestros ópticos contactólogos.",
    url: "https://atelieroptica.com.ar/blog/faq",
    images: [
      {
        url: "/images/blog/blog1_header.png",
        width: 1200,
        height: 630,
        alt: "FAQ Salud Visual",
      }
    ]
  }
};

const faqs = [
  {
    category: "Miopía Infantil y Lentes Especiales",
    questions: [
      {
        question: "¿A qué edad se estabiliza la miopía en los niños?",
        answer: "La miopía suele estabilizarse alrededor de los 18 a 21 años, cuando el ojo deja de crecer. Sin embargo, es crucial actuar durante la niñez y preadolescencia (entre los 6 y 14 años) utilizando tecnologías de control de miopía como Stellest o Myopilux para ralentizar su progresión y evitar altas miopías en la adultez.",
        link: "/blog/busquedas/a-que-edad-se-estabiliza-la-miopia"
      },
      {
        question: "¿Qué diferencia hay entre los lentes Stellest y los Myopilux?",
        answer: "Ambos son cristales diseñados por Essilor para frenar la miopía infantil. Myopilux utiliza un diseño prismático y bifocal ideal para niños con problemas de acomodación. Stellest es la tecnología más avanzada, que utiliza una constelación de microlentes invisibles (tecnología H.A.L.T.) para crear un volumen de señal que ralentiza el crecimiento del ojo. Tu oftalmólogo indicará el adecuado.",
        link: "/blog/busquedas/diferencia-entre-stellest-y-lentes-comunes"
      },
      {
        question: "¿Por qué le avanza tan rápido la miopía a mi hijo?",
        answer: "El avance rápido de la miopía infantil se debe a factores genéticos sumados a factores ambientales modernos: el exceso de visión cercana (pantallas, celulares, tablets) y la falta de exposición a la luz solar al aire libre. Las lentes de control de miopía combaten este efecto fisiológico de elongación del ojo.",
        link: "/blog/busquedas/miopia-infantil-avanza-muy-rapido"
      }
    ]
  },
  {
    category: "Tecnología Blue Block (Filtro Azul)",
    questions: [
      {
        question: "¿Qué son los anteojos Blue Block y para qué sirven?",
        answer: "Los anteojos Blue Block tienen un cristal diseñado para bloquear la luz azul-violeta nociva que emiten las pantallas digitales (celulares, monitores, luces LED). Sirven para reducir la fatiga visual digital, prevenir dolores de cabeza y mejorar la calidad del sueño al evitar la alteración de los ritmos circadianos.",
        link: "/blog/busquedas/que-son-los-anteojos-blue-block"
      },
      {
        question: "¿Cuál es la diferencia entre filtro azul (Blue Block) y antirreflex?",
        answer: "El antirreflex (AR) es un tratamiento que elimina los reflejos en la superficie del lente, mejorando la transparencia y la estética. El filtro azul (Blue Block), además de tener antirreflex, bloquea una longitud de onda específica de luz azul dañina. Ambos tratamientos se combinan para ofrecer la máxima protección en el cristal.",
        link: "/blog/busquedas/diferencia-entre-blue-block-y-antirreflex"
      },
      {
        question: "¿Es bueno usar lentes con filtro azul todo el día?",
        answer: "Sí, es completamente seguro y recomendado. Los lentes Blue Block modernos dejan pasar la luz azul-turquesa (esencial para el ciclo del sueño y el bienestar) mientras bloquean la luz azul-violeta nociva. Podés usarlos como anteojos de uso continuo sin ningún problema.",
        link: "/blog/busquedas/es-bueno-usar-lentes-blue-block-todo-el-dia"
      }
    ]
  },
  {
    category: "Tecnología Smart (Meta Ray-Ban)",
    questions: [
      {
        question: "¿Qué funciones tienen los anteojos inteligentes Meta Ray-Ban?",
        answer: "Las gafas inteligentes Meta Ray-Ban te permiten capturar fotos y videos en alta calidad (12 MP) desde tu perspectiva, escuchar música con parlantes open-ear integrados en las patillas, responder llamadas telefónicas y usar comandos de voz con Meta AI, todo sin sacar el celular del bolsillo.",
        link: "/blog/busquedas/anteojos-inteligentes-ray-ban-meta"
      },
      {
        question: "¿Se pueden poner cristales con aumento en los Meta Ray-Ban?",
        answer: "¡Sí! En Atelier Óptica somos especialistas en calibrar cristales recetados (monofocales o multifocales) e incluso cristales Transitions o polarizados en marcos Meta Ray-Ban. El proceso es seguro y mantiene todas las funciones tecnológicas intactas.",
        link: "/blog/busquedas/ray-ban-meta-precio-argentina"
      }
    ]
  },
  {
    category: "Multifocales y Salud Visual General",
    questions: [
      {
        question: "¿Cómo sabés si necesitás usar anteojos para leer?",
        answer: "Si tenés más de 40 años y empezás a alejar el celular o los libros para verlos nítidos, necesitás más luz para leer, o sufrís de dolores de cabeza tras esfuerzo visual de cerca, es probable que tengas presbicia. Es momento de consultar a un oftalmólogo para una receta de lentes de cerca o multifocales.",
        link: "/blog/busquedas/como-saber-si-necesito-anteojos"
      },
      {
        question: "¿Qué tipo de anteojos me quedan bien según mi cara?",
        answer: "Como regla general, buscamos contraste: si tu cara es redonda, los armazones rectangulares o cuadrados (tipo Wayfarer) afinan el rostro. Si tenés cara cuadrada, los lentes redondos o pantos suavizan las facciones. Los rostros ovalados pueden usar casi cualquier formato. En nuestro local te brindamos asesoramiento estético personalizado.",
        link: "/blog/busquedas/como-elegir-anteojos-segun-mi-cara"
      }
    ]
  }
];

// Generate JSON-LD Schema for Google SEO
function generateFAQSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.flatMap(category => 
      category.questions.map(q => ({
        "@type": "Question",
        "name": q.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": q.answer
        }
      }))
    )
  };
  return JSON.stringify(schema);
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 font-sans">
      <StorefrontNavbar theme="light" />
      
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: generateFAQSchema() }}
      />

      {/* Hero Section */}
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/blog" className="inline-flex items-center text-primary hover:text-primary/80 font-medium text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Blog
          </Link>
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Preguntas Frecuentes
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            Respuestas directas de nuestros ópticos contactólogos a las dudas más comunes sobre salud visual, cristales y tecnología.
          </p>
        </div>
      </div>

      {/* FAQ Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-12">
          {faqs.map((category, idx) => (
            <div key={idx} className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 p-8 lg:p-10">
              <h2 className="text-2xl font-bold text-stone-900 dark:text-white mb-8 border-b border-stone-100 dark:border-stone-800 pb-4">
                {category.category}
              </h2>
              <div className="space-y-6">
                {category.questions.map((q, qIdx) => (
                  <details key={qIdx} className="group cursor-pointer">
                    <summary className="flex items-center justify-between font-semibold text-lg text-stone-800 dark:text-stone-200 list-none">
                      <span>{q.question}</span>
                      <span className="transition group-open:rotate-180 ml-4 flex-shrink-0 text-primary">
                        <ChevronDown className="w-5 h-5" />
                      </span>
                    </summary>
                    <div className="text-stone-600 dark:text-stone-400 mt-4 leading-relaxed pl-2 border-l-2 border-primary/20">
                      <p className="mb-3">{q.answer}</p>
                      {q.link && (
                        <Link href={q.link} className="text-primary font-medium hover:underline inline-flex items-center text-sm">
                          Leer más sobre esto <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                        </Link>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center bg-primary/10 rounded-3xl p-10">
          <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">¿No encontraste lo que buscabas?</h3>
          <p className="text-stone-600 dark:text-stone-400 mb-8">
            Nuestro equipo de especialistas está listo para responder tus dudas por WhatsApp.
          </p>
          <a 
            href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent('Hola, tengo una consulta sobre anteojos/cristales.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 bg-[#25D366] text-white rounded-full font-bold text-lg shadow-lg hover:bg-[#20bd5a] hover:-translate-y-1 transition-all"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Hacer mi consulta
          </a>
        </div>
      </div>

      <StorefrontFooter />
      
    </div>
  );
}