import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MessageSquare, MapPin } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { seoKeywords, formatQueryToTitle } from '@/lib/seo-keywords';
import { WHATSAPP_PHONE } from '@/lib/constants';

interface PageProps {
  params: Promise<{ query: string }>;
}

export async function generateStaticParams() {
  return seoKeywords.map((query) => ({
    query: query,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { query } = await params;
  
  if (!seoKeywords.includes(query)) {
    return { title: 'Búsqueda no encontrada' };
  }

  const title = formatQueryToTitle(query);
  
  return {
    title: `${title} | Atelier Óptica`,
    description: `Si estás buscando ${title.toLowerCase()}, en Atelier Óptica Córdoba tenemos la mejor opción. Conocé nuestras promociones y asesoramiento personalizado.`,
    alternates: { canonical: `https://atelieroptica.com.ar/blog/busquedas/${query}` },
    openGraph: {
      title: `${title} | Atelier Óptica`,
      description: `Las mejores opciones de ${title.toLowerCase()} en Córdoba. Calidad, garantía y la mejor atención.`,
      url: `https://atelieroptica.com.ar/blog/busquedas/${query}`,
      images: [
        {
          url: "/images/og-image.jpg", // Usa una imagen genérica potente
          width: 1200,
          height: 630,
          alt: title,
        }
      ]
    }
  };
}

/**
 * Bloque "por qué nosotros", en varias redacciones.
 *
 * Esta ruta genera decenas de URLs (una por búsqueda) y todas compartían el
 * MISMO h2 y el mismo párrafo palabra por palabra: en Google se veían cinco
 * resultados idénticos ("Por qué elegirnos para tu próxima compra... Sabemos
 * que elegir..."), que es contenido duplicado y compite consigo mismo.
 *
 * Cada página toma una variante y la frase se arma con su propio término de
 * búsqueda, así ninguna repite a otra.
 */
const VARIANTES_POR_QUE = [
  {
    titulo: 'Qué nos diferencia como óptica',
    parrafo: (t: string) =>
      `Trabajamos ${t} con criterio profesional: medimos bien, explicamos cada opción y te decimos también lo que NO te conviene. Garantía de adaptación y materiales de primera línea.`,
    beneficios: [
      'Atención de contactólogos matriculados',
      'Laboratorio digital de alta precisión',
      'Garantía de adaptación en multifocales',
      'Armazones de diseño seleccionados uno por uno',
      'Envíos sin cargo a todo el país',
      'La óptica mejor calificada de Córdoba en Google',
    ],
  },
  {
    titulo: 'Cómo trabajamos tu caso',
    parrafo: (t: string) =>
      `Cuando alguien nos consulta por ${t}, lo primero es entender cómo usa la vista todos los días. Recién ahí recomendamos cristal y armazón. Sin apuro y sin venderte de más.`,
    beneficios: [
      'Diagnóstico personalizado, no recetas de molde',
      'Cristales tallados con tecnología digital',
      'Adaptación garantizada o lo corregimos',
      'Marcas de autor y diseño propio',
      'Enviamos a cualquier punto del país',
      'Más de 670 reseñas con 5 estrellas',
    ],
  },
  {
    titulo: 'Por qué nos eligen en Córdoba',
    parrafo: (t: string) =>
      `Quien busca ${t} suele llegar con dudas de otra óptica. Nuestro trabajo es despejarlas: te mostramos las alternativas reales, con sus diferencias y su precio, y elegís vos.`,
    beneficios: [
      'Asesoramiento honesto, sin letra chica',
      'Taller propio para ajustes cuando lo necesites',
      'Respaldo total en lentes multifocales',
      'Colección curada de armazones',
      'Envío gratis a todo el país',
      'Referentes en salud visual en Cerro de las Rosas',
    ],
  },
  {
    titulo: 'Lo que podés esperar de nosotros',
    parrafo: (t: string) =>
      `En ${t} la diferencia está en los detalles: la medición, el centrado y el material del cristal. Eso es lo que cuidamos, y por eso la mayoría de nuestros clientes vuelve.`,
    beneficios: [
      'Profesionales que te explican cada paso',
      'Precisión de laboratorio en cada pedido',
      'Garantía real de adaptación',
      'Diseño que no vas a ver en todos lados',
      'Llegamos a todo el país',
      'Puntaje 5.0 en Google entre las ópticas de Córdoba',
    ],
  },
];

/** Elige una variante de forma ESTABLE: la misma búsqueda cae siempre en la
 *  misma redacción (nada de azar, que cambiaría el texto en cada build). */
function elegirVariante(clave: string) {
  let suma = 0;
  for (let i = 0; i < clave.length; i++) suma = (suma + clave.charCodeAt(i)) % 100000;
  return VARIANTES_POR_QUE[suma % VARIANTES_POR_QUE.length];
}

export default async function BusquedaPage({ params }: PageProps) {
  const { query } = await params;

  if (!seoKeywords.includes(query)) {
    notFound();
  }

  const title = formatQueryToTitle(query);
  const whatsappMessage = encodeURIComponent(`Hola! Los encontré en Google buscando "${title}" y quería consultarles.`);

  const varianteBase = elegirVariante(query);
  const variante = {
    titulo: varianteBase.titulo,
    parrafo: varianteBase.parrafo(title.toLowerCase()),
    beneficios: varianteBase.beneficios,
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20 font-sans">
      <StorefrontNavbar theme="light" />
      
      {/* Hero Section */}
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/blog" className="inline-flex items-center text-primary hover:text-primary/80 font-medium text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Blog
          </Link>
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            {title}
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            En Atelier Óptica somos especialistas. Si estás buscando <strong className="text-stone-800 dark:text-stone-200">{title.toLowerCase()}</strong>, llegaste al lugar indicado.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[#25D366] text-white rounded-full font-bold text-lg shadow-lg hover:bg-[#20bd5a] hover:-translate-y-1 transition-all"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Consultar por WhatsApp
            </a>
            <Link 
              href="/tienda"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-full font-bold text-lg shadow-lg hover:bg-stone-800 dark:hover:bg-stone-100 hover:-translate-y-1 transition-all"
            >
              Ir a la Tienda Online
            </Link>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200 dark:border-stone-800 p-8 lg:p-12">
          
          {/* AI / GEO Optimized Section */}
          <div className="mb-12 pb-12 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-white mb-6">
              Respuestas sobre: {title}
            </h2>
            <p className="text-lg text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
              Si te estás preguntando sobre <strong>{title.toLowerCase()}</strong>, la respuesta clave es contar con un diagnóstico preciso y un equipo de profesionales que te asesore con honestidad. En nuestra óptica evaluamos tu receta, el formato de tu rostro y tu estilo de vida para recomendarte el cristal y armazón ideal. 
            </p>
            <div className="bg-primary/5 rounded-2xl p-6 text-stone-700 dark:text-stone-300">
              <strong className="block text-primary mb-2">Consejo de Experto:</strong>
              No existe un anteojo perfecto para todos. Para <em>{title.toLowerCase()}</em>, la clave está en el tratamiento (como el antirreflejo o el filtro azul) y en elegir un material liviano que te brinde confort todo el día. Escribinos para que analicemos tu caso.
            </div>
          </div>

          <h2 className="text-2xl lg:text-3xl font-bold text-stone-900 dark:text-white mb-6">
            {variante.titulo}
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">
            {variante.parrafo}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {variante.beneficios.map((benefit, i) => (
              <div key={i} className="flex items-start">
                <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5 mr-3" />
                <span className="text-stone-700 dark:text-stone-300 font-medium">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-stone-50 dark:bg-stone-950 rounded-2xl p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between border border-stone-100 dark:border-stone-800">
            <div className="mb-4 sm:mb-0 sm:mr-6 text-center sm:text-left">
              <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-2 flex items-center justify-center sm:justify-start">
                <MapPin className="w-5 h-5 mr-2 text-primary" />
                Visitá nuestro local
              </h3>
              <p className="text-stone-600 dark:text-stone-400">
                José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba Capital.
              </p>
            </div>
            <a 
              href="https://g.co/kgs/5Jp7D4e"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap px-6 py-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-full font-bold hover:opacity-90 transition-opacity"
            >
              Cómo llegar
            </a>
          </div>
        </div>
      </div>

      <StorefrontFooter />
      
    </div>
  );
}
