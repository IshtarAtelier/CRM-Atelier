import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MessageSquare, MapPin } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { seoKeywords, formatQueryToTitle } from '@/lib/seo-keywords';

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
          url: "/images/blog/blog1_header.png", // Usa una imagen genérica potente
          width: 1200,
          height: 630,
          alt: title,
        }
      ]
    }
  };
}

export default async function BusquedaPage({ params }: PageProps) {
  const { query } = await params;

  if (!seoKeywords.includes(query)) {
    notFound();
  }

  const title = formatQueryToTitle(query);
  const whatsappMessage = encodeURIComponent(`Hola! Los encontré en Google buscando "${title}" y quería consultarles.`);

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
              href={`https://wa.me/5493513447219?text=${whatsappMessage}`}
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
            Por qué elegirnos para tu próxima compra
          </h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 mb-8 leading-relaxed">
            Sabemos que elegir la óptica correcta es fundamental para tu salud visual. Ofrecemos asesoramiento honesto, garantía total de adaptación y los mejores materiales del mercado.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              "Asesoramiento personalizado por contactólogos",
              "Laboratorio digital de alta precisión",
              "Garantía de adaptación en multifocales",
              "Armazones con diseño de vanguardia",
              "Envíos a todo el país",
              "Mejor óptica calificada en Córdoba"
            ].map((benefit, i) => (
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
