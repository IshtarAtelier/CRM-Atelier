import { Metadata } from 'next';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { Sparkles, Eye, MapPin, Heart } from 'lucide-react';
import { WHATSAPP_PHONE } from '@/lib/constants';
import { buildWhatsAppUrl } from '@/lib/whatsapp-link';

export const metadata: Metadata = {
  title: "Quiénes Somos",
  description: "Conocé Atelier Óptica, especialistas en salud visual en el Cerro de las Rosas. Diseño, atención personalizada y cristales de alta gama.",
  alternates: { canonical: 'https://atelieroptica.com.ar/quienes-somos' },
  openGraph: {
    title: "Quiénes Somos",
    description: "Conocé Atelier Óptica, especialistas en salud visual en el Cerro de las Rosas. Diseño, atención personalizada y cristales de alta gama.",
    type: "website",
    url: "https://atelieroptica.com.ar/quienes-somos",
    images: [
      {
        url: "/images/blog/fachada-ladrillo.webp",
        width: 1200,
        height: 630,
        alt: "Atelier Óptica",
      }
    ]
  }
};

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      
      {/* Hero Section */}
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-6">
            Quiénes <span className="text-primary italic">Somos</span>
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-relaxed">
            En Atelier Óptica, tu visión es nuestra obra maestra. Somos un equipo de ópticos creativos que ama lo que hace.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        
        {/* Intro */}
        <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-12 border border-stone-200 dark:border-stone-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Eye className="w-48 h-48" />
          </div>
          <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-6 relative z-10">Cuidado visual <span className="text-primary">100% personalizado</span></h2>
          <div className="text-stone-600 dark:text-stone-300 space-y-4 text-lg relative z-10">
            <p>
              Creemos que cuidar tu salud visual puede ser una experiencia moderna, cálida y distinta a las ópticas tradicionales. Con una sólida trayectoria y un compromiso constante con la capacitación y la innovación, queremos transformar la forma en que vivís tus anteojos.
            </p>
            <p className="font-medium text-stone-800 dark:text-stone-200">
              Porque para nosotros, ver bien también es verte bien.
            </p>
          </div>
        </section>

        {/* Mision */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-primary/5 rounded-3xl p-8 lg:p-10 border border-primary/10">
            <div className="w-12 h-12 bg-white dark:bg-stone-900 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Nuestra misión</h3>
            <p className="text-stone-600 dark:text-stone-300 mb-6">
              Brindar un servicio óptico que combine tecnología de vanguardia, asesoramiento personalizado y productos con diseño y calidad, pensados para cada mirada.
            </p>
            <ul className="space-y-3">
              {[
                "Cristales y lentes de última generación",
                "Atención profesional y cercana",
                "Soluciones visuales que cuidan tu salud y potencian tu estilo"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-stone-700 dark:text-stone-300">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-stone-100 dark:bg-stone-900 rounded-3xl p-8 lg:p-10 border border-stone-200 dark:border-stone-800">
            <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-sm">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Calidad, experiencia y estilo</h3>
            <p className="text-stone-600 dark:text-stone-300 mb-6">
              Llevamos años ayudando a miles de personas a ver mejor y verse mejor. Trabajamos con marcas líderes como Varilux, Vulk y Rusty para ofrecerte:
            </p>
            <ul className="space-y-3">
              {[
                "Alta calidad óptica",
                "Máximo confort y adaptación",
                "Diseños con identidad y estilo propio"
              ].map((item, i) => (
                <li key={i} className="flex items-start text-stone-700 dark:text-stone-300">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Ubicacion */}
        <section className="bg-white dark:bg-stone-900 rounded-3xl p-8 lg:p-12 border border-stone-200 dark:border-stone-800 shadow-sm text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <MapPin className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black text-stone-900 dark:text-white mb-4">Dónde estamos</h2>
          <p className="text-lg text-stone-600 dark:text-stone-300 max-w-2xl mx-auto mb-6">
            Nos encontramos en <strong>José Luis de Tejeda 4380</strong>, en el corazón del Cerro de las Rosas, Córdoba. Un espacio pensado para que elijas tus anteojos como se elige una prenda de autor.
          </p>
          <p className="text-primary font-medium">¿Vivís en otra ciudad? ¡No hay problema! Hacemos envíos a todo el país.</p>
        </section>

        {/* Cierre */}
        <div className="text-center pt-8">
          <h3 className="text-2xl font-bold text-stone-900 dark:text-white mb-4">Te acompañamos a descubrir tu visión del mundo</h3>
          <p className="text-stone-600 dark:text-stone-400 max-w-xl mx-auto mb-8">
            Desde el primer momento, estamos acá para ayudarte, asesorarte y acompañarte en cada paso. Porque en Atelier Óptica, tu visión es nuestra obra maestra.
          </p>
          <a
            href={buildWhatsAppUrl("¡Hola! Quiero conocer más sobre Atelier Óptica y recibir asesoramiento.", { phone: WHATSAPP_PHONE })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-stone-900 text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors rounded-full"
          >
            Hablar con un Asesor
          </a>
        </div>

      </div>

      <StorefrontFooter />
      
    </div>
  );
}
