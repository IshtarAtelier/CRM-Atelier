import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, BookOpen } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { FloatingWhatsApp } from '@/components/Storefront/FloatingWhatsApp';

export const metadata: Metadata = {
  title: "Blog de Salud Visual y Novedades | Atelier Óptica Córdoba",
  description: "Descubrí consejos sobre salud visual, multifocales, anteojos recetados y lo último en tendencias de gafas de sol en Córdoba.",
  openGraph: {
    title: "Blog de Salud Visual y Novedades | Atelier Óptica Córdoba",
    description: "Descubrí consejos sobre salud visual, multifocales, anteojos recetados y lo último en tendencias de gafas de sol en Córdoba.",
    type: "website",
    url: "https://www.atelieroptica.com.ar/blog",
    images: [
      {
        url: "/images/blog/blog1_header.png",
        width: 1200,
        height: 630,
        alt: "Blog de Atelier Óptica",
      }
    ]
  }
};

const posts = [
  {
    slug: 'ray-ban-meta-smart-glasses-cordoba',
    title: 'Ray-Ban Meta: Los anteojos inteligentes que graban tu vida ya están en Córdoba',
    excerpt: 'No tienen pantallas molestas. Graban videos en alta definición, sacan fotos, reproducen música y tienen Inteligencia Artificial integrada. Conseguilos en Atelier.',
    date: '2026-05-20',
    category: 'Smart Glasses',
    imageUrl: '/images/blog/blog1_marcos.png'
  },
  {
    slug: 'lentes-wicue-oscurecen-con-boton',
    title: 'Lentes Wicue: La tecnología electrocrómica que oscurece tus anteojos con un botón',
    excerpt: 'Olvidate de esperar a que el sol oscurezca tus lentes fotocromáticos. Con Wicue, controlás la oscuridad de tus cristales en una fracción de segundo.',
    date: '2026-05-20',
    category: 'Tecnología',
    imageUrl: '/images/blog/blog3_eligiendo.png'
  },
  {
    slug: 'matias-turchi',
    title: 'Matías Turchi: Nuestro Especialista en Multifocales Essilor Expert',
    excerpt: 'Conocé al profesional detrás de nuestras mediciones de precisión. Matías cuenta con múltiples certificaciones y años de experiencia en adaptación de lentes de alta tecnología.',
    date: '2026-05-19',
    category: 'Nuestro Equipo',
    imageUrl: '/images/blog/matias-turchi.png'
  },
  {
    slug: 'control-miopia',
    title: 'Control de Miopía: La revolución del desenfoque periférico',
    excerpt: 'La miopía ya no es solo un problema de corrección visual; es un desafío global. Descubrí cómo la tecnología Essilor Stellest frena su avance.',
    date: '2026-05-19',
    category: 'Pediatría',
    imageUrl: '/images/blog/vidriera-atelier.jpg'
  },
  {
    slug: 'tratamiento-antirreflex-crizal-sapphire',
    title: 'Tratamientos Crizal: Por qué un buen antirreflex cambia tu forma de ver el mundo',
    excerpt: 'No todos los antirreflejos son iguales. Descubrí cómo la tecnología Crizal Sapphire y Prevencia protegen tus ojos y hacen que tus lentes duren años.',
    date: '2026-05-20',
    category: 'Cristales',
    imageUrl: '/images/blog/mostrador-marmol.jpg'
  },
  {
    slug: 'lentes-eyezen-descanso-pantallas-essilor',
    title: 'Lentes Eyezen de Essilor: El descanso definitivo si usás pantallas todo el día',
    excerpt: 'No son simples lentes de descanso. Eyezen es un cristal de visión sencilla con un "boost" de potencia diseñado para relajar tus ojos frente al celular.',
    date: '2026-05-19',
    category: 'Tecnología Essilor',
    imageUrl: '/images/blog/muestrario-smart-lens.jpg'
  },
  {
    slug: 'lentes-stellest-control-miopia-infantil',
    title: 'Lentes Stellest: Cómo frenar el avance de la miopía en los niños',
    excerpt: 'La miopía infantil avanza rápido. Conocé la tecnología de Essilor que no solo corrige la visión de tu hijo, sino que ralentiza su empeoramiento.',
    date: '2026-05-18',
    category: 'Pediatría',
    imageUrl: '/images/blog/vidriera-atelier.jpg'
  },
  {
    slug: 'varilux-xr-series-inteligencia-artificial',
    title: 'Varilux XR Series: El primer multifocal con Inteligencia Artificial que predice tu mirada',
    excerpt: 'Descubrí la revolución de Essilor. Lentes progresivos que entienden cómo movés tus ojos y garantizan un campo visual inmenso sin mareos.',
    date: '2026-05-20',
    category: 'Tecnología Varilux',
    imageUrl: '/images/blog/local-varilux.jpg'
  },
  {
    slug: 'varilux-comfort-max-dolor-de-cuello',
    title: '¿Dolor de cuello frente a la compu? Por qué el Varilux Comfort Max es la solución',
    excerpt: 'Si trabajás 8 horas frente a una pantalla, tu postura sufre. Conocé cómo el diseño ergonómico de Varilux te permite ver bien sin levantar la barbilla.',
    date: '2026-05-19',
    category: 'Salud Visual',
    imageUrl: '/images/blog/mostrador-marmol.jpg'
  },
  {
    slug: 'varilux-vs-genericos-diferencias',
    title: 'Varilux vs Multifocales Genéricos: ¿Vale la pena la diferencia de precio?',
    excerpt: 'Derribamos mitos. Te mostramos exactamente qué cambia entre un lente progresivo de alta gama y uno económico (con esquemas de campo visual reales).',
    date: '2026-05-18',
    category: 'Cristales',
    imageUrl: '/images/blog/muestrario-smart-lens.jpg'
  },

  {
    slug: 'mejor-optica-multifocales-cordoba',
    title: 'La mejor óptica para multifocales en Córdoba: Por qué elegirnos',
    excerpt: 'Descubrí por qué Atelier Óptica es la óptica con mejores comentarios y la más recomendada de Córdoba para lentes multifocales y progresivos.',
    date: '2026-04-26',
    category: 'Multifocales',
    imageUrl: '/images/blog/blog1_header.png'
  },
  {
    slug: 'precio-multifocales-cordoba-2026',
    title: 'Precio de Lentes Multifocales en Córdoba 2026: Guía Completa',
    excerpt: 'Todo lo que necesitás saber sobre cuánto cuestan los lentes multifocales en Córdoba, qué marcas elegir y dónde encontrar la mejor relación calidad-precio.',
    date: '2026-04-25',
    category: 'Multifocales',
    imageUrl: '/images/blog/blog2_header.png'
  },
  {
    slug: 'optica-exclusiva-cerro-rosas-cordoba',
    title: 'Óptica exclusiva en Cerro de las Rosas: Atención personalizada y multifocales premium',
    excerpt: 'Conocé la óptica más exclusiva de Córdoba Capital, con atención uno a uno, garantía de adaptación en multifocales y armazones de diseño.',
    date: '2026-04-24',
    category: 'Nuestra Óptica',
    imageUrl: '/images/blog/blog3_header.png'
  },
  {
    slug: 'multifocales-primera-vez-guia-cordoba',
    title: 'Multifocales por primera vez: Guía paso a paso para elegir bien en Córdoba',
    excerpt: 'Si tu oftalmólogo te recetó multifocales por primera vez, esta guía te explica todo para que no te equivoques al comprarlos.',
    date: '2026-04-23',
    category: 'Salud Visual',
    imageUrl: '/images/blog/blog4_header.png'
  },
  {
    slug: 'multifocales-trabajo-oficina-cordoba',
    title: 'Multifocales para el trabajo: Cómo ver perfecto la computadora y el celular',
    excerpt: 'Lentes progresivos optimizados para la oficina. La solución definitiva al dolor de cuello y la fatiga visual si trabajás con pantallas en Córdoba.',
    date: '2026-04-22',
    category: 'Tecnología',
    imageUrl: '/images/blog/blog5_header.png'
  },
  {
    slug: 'guia-multifocales-cordoba',
    title: 'Lentes Multifocales en Córdoba: Todo lo que necesitas saber',
    excerpt: '¿Qué son los cristales multifocales y cómo elegir los mejores para tu visión? Consejos para una adaptación rápida y sin mareos.',
    date: '2026-04-20',
    category: 'Salud Visual',
    imageUrl: '/images/blog/blog6_header.png'
  },
  {
    slug: 'elegir-anteojos-recetados',
    title: 'Cómo elegir anteojos recetados según la forma de tu cara',
    excerpt: 'Guía definitiva para comprar anteojos recetados que combinen con tu estilo y te brinden la mejor comodidad óptica.',
    date: '2026-04-15',
    category: 'Tendencias',
    imageUrl: '/images/blog/arte-venus.jpg'
  },
  {
    slug: 'optica-cordoba-cerro-de-las-rosas',
    title: 'Por qué somos la óptica recomendada en Cerro de las Rosas',
    excerpt: 'Conocé Atelier Óptica, especialistas en atención personalizada, armazones de diseño y cristales de alta precisión en Córdoba.',
    date: '2026-04-10',
    category: 'Nuestra Óptica',
    imageUrl: '/images/blog/fachada-ladrillo.jpg'
  },
  {
    slug: 'lentes-de-sol-tendencias-2026',
    title: 'Lentes de Sol en Córdoba: Tendencias 2026 y Protección UV',
    excerpt: 'Descubrí los armazones que son furor este año y por qué el filtro UV400 es innegociable para cuidar tu vista.',
    date: '2026-04-25',
    category: 'Tendencias',
    imageUrl: '/images/blog/local-varilux.jpg'
  },
  {
    slug: 'como-leer-tu-receta-oftalmologica',
    title: 'Cómo leer tu receta oftalmológica paso a paso',
    excerpt: '¿Qué significan Esfera, Cilindro, Eje y Adición? Te explicamos de forma sencilla cómo interpretar lo que te recetó el oftalmólogo.',
    date: '2026-04-22',
    category: 'Salud Visual',
    imageUrl: '/images/blog/muestrario-smart-lens.jpg'
  },
  {
    slug: 'filtro-azul-pantallas',
    title: 'Filtro Azul (Blue Light Cut): ¿Mito o necesidad si trabajás frente a pantallas?',
    excerpt: 'Si sentís fatiga visual o dolores de cabeza después de tu jornada de trabajo, enterate por qué los cristales con filtro azul son fundamentales.',
    date: '2026-04-26',
    category: 'Tecnología',
    imageUrl: '/images/blog/mostrador-marmol.jpg'
  },
  {
    slug: 'cristales-fotocromaticos-transitions',
    title: 'Cristales Fotocromáticos: Todo sobre los lentes que se oscurecen con el sol',
    excerpt: 'Comodidad total: lentes recetados en el interior y lentes de sol en el exterior. Descubrí cómo funciona la tecnología fotocromática.',
    date: '2026-04-27',
    category: 'Cristales',
    imageUrl: '/images/blog/muestrario-smart-lens.jpg'
  },
  {
    slug: 'anteojos-para-ninos',
    title: 'Anteojos para niños: ¿Cuándo hacer el primer control visual?',
    excerpt: 'Señales de alerta de que tu hijo necesita lentes y qué armazones infantiles (flexibles e irrompibles) son los más recomendados.',
    date: '2026-04-28',
    category: 'Pediatría',
    imageUrl: '/images/blog/vidriera-atelier.jpg'
  },
  {
    slug: 'como-limpiar-tus-anteojos',
    title: 'Guía definitiva para limpiar tus anteojos sin rayar el antirreflex',
    excerpt: 'El error más común es usar la remera o servilletas de papel. Aprendé los pasos correctos para que tus cristales duren años como nuevos.',
    date: '2026-04-29',
    category: 'Mantenimiento',
    imageUrl: '/images/blog/mostrador-marmol.jpg'
  },
  {
    slug: 'multifocales-marcas-precios-varilux-novar',
    title: 'Marcas de Multifocales en Argentina: ¿Qué diferencias hay entre Varilux, Novar y genéricos?',
    excerpt: 'Comparativa definitiva sobre campos visuales, tecnologías de tallado digital y por qué el precio de un multifocal varía tanto.',
    date: '2026-05-02',
    category: 'Cristales',
    imageUrl: '/images/blog/local-varilux.jpg'
  },
  {
    slug: 'mareos-con-multifocales-soluciones',
    title: '¿Tus multifocales te marean? Causas principales y cómo solucionarlo',
    excerpt: 'Si sentís que el piso se mueve o te duele la cabeza al usar progresivos, te contamos por qué pasa y cómo lo calibramos para solucionarlo.',
    date: '2026-05-04',
    category: 'Salud Visual',
    imageUrl: '/images/blog/fachada-ladrillo.jpg'
  },
  {
    slug: 'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
    title: 'Por qué nuestros multifocales no fallan: Tecnología de medición en Córdoba',
    excerpt: 'Hacer un lente progresivo perfecto requiere mucho más que una receta. Conocé nuestro proceso de toma de medidas de alta precisión para una adaptación garantizada.',
    date: '2026-05-06',
    category: 'Nuestra Óptica',
    imageUrl: '/images/blog/arte-monalisa.jpg'
  },
  {
    slug: 'pasos-faciles-adaptacion-multifocales',
    title: '3 Pasos Fáciles para Adaptarte a tus Multifocales (Sin Estrés)',
    excerpt: 'Acostumbrarse a los lentes progresivos es mucho más natural de lo que parece. Seguí estos 3 simples pasos y empezá a disfrutar de una visión perfecta.',
    date: '2026-05-08',
    category: 'Salud Visual',
    imageUrl: '/images/blog/anteojos-rosa-pastel.jpg'
  },
  {
    slug: 'bifocales-vs-multifocales-diferencias',
    title: 'Bifocales vs Multifocales: Por qué es momento de decirle adiós a la "rayita"',
    excerpt: '¿Seguís usando lentes divididos en dos? Te explicamos por qué la tecnología progresiva es estéticamente superior y mucho más cómoda para tu vista.',
    date: '2026-05-10',
    category: 'Cristales',
    imageUrl: '/images/blog/arte-monalisa.jpg'
  },
  {
    slug: 'multifocales-ocupacionales-para-computadora',
    title: 'Multifocales Ocupacionales: El secreto para trabajar en la computadora sin dolor de cuello',
    excerpt: 'Si tu multifocal clásico te molesta para mirar el monitor, los lentes ocupacionales son la solución definitiva para oficinistas y profesionales.',
    date: '2026-05-12',
    category: 'Tecnología',
    imageUrl: '/images/blog/lentes-progresivos-zonas.png'
  },
  {
    slug: 'experiencia-boutique-atelier-optica',
    title: 'Más que una óptica: La experiencia Boutique en el corazón del Cerro',
    excerpt: 'Lejos de los fríos mostradores clínicos. Conocé cómo fusionamos la precisión visual con el arte, el diseño y un servicio cálido y personalizado.',
    date: '2026-05-15',
    category: 'Nuestra Óptica',
    imageUrl: '/images/blog/vidriera-atelier.jpg'
  },
  {
    slug: 'diseno-y-marcas-armazones-cordoba',
    title: 'Colecciones de Autor: Cómo curamos los armazones que marcan tendencia',
    excerpt: 'No vendemos cualquier marco. Cada anteojo en nuestras estanterías fue elegido por su diseño, calidad y capacidad para resaltar tus facciones.',
    date: '2026-05-18',
    category: 'Tendencias',
    imageUrl: '/images/blog/anteojos-rosa-pastel.jpg'
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <StorefrontNavbar theme="light" />
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10 pt-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">
            Blog <span className="text-primary italic">Atelier</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Noticias, consejos de salud visual y guías sobre anteojos y multifocales en Córdoba.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[300px] md:auto-rows-[350px] grid-flow-row-dense">
          {posts.reduce((acc, post, index) => {
            const visualBlocks = [
              '/images/blog/blog1_marcos.png',
              '/images/blog/blog2_homeoffice.png',
              '/images/blog/blog3_eligiendo.png',
              '/images/blog/blog4_leyendo.png',
              '/images/blog/blog5_cordoba.png',
              '/images/blog/blog6_consulta.png'
            ];
            
            // Build the layout style
            let layoutStyle = 'col-span-1 row-span-1';
            let titleSize = 'text-lg lg:text-xl';
            let excerptLines = 'line-clamp-2 lg:line-clamp-3';
            let imgHeight = 'h-32 lg:h-48';
            let showExcerpt = true;

            if (index === 0) {
              layoutStyle = 'col-span-1 md:col-span-2 lg:col-span-2 row-span-2'; // Featured (huge)
              titleSize = 'text-2xl lg:text-4xl';
              excerptLines = 'line-clamp-4';
              imgHeight = 'h-1/2 lg:h-[60%]';
            } else if (index === 2) {
              layoutStyle = 'col-span-1 lg:col-span-1 row-span-2'; // Tall
              titleSize = 'text-xl lg:text-2xl';
              excerptLines = 'line-clamp-4';
              imgHeight = 'h-1/2';
            } else if (index === 3) {
              layoutStyle = 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1'; // Wide
              showExcerpt = false; // keep it clean
            } else if (index % 5 === 0) {
              layoutStyle = 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1'; // Wide
              showExcerpt = false;
            } else if (index % 7 === 0) {
              layoutStyle = 'col-span-1 lg:col-span-1 row-span-2'; // Tall
            }

            // Post Element
            const postElement = (
              <Link key={post.slug} href={`/blog/${post.slug}`} className={`group bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 overflow-hidden flex flex-col ${layoutStyle}`}>
                <div className={`${imgHeight} w-full overflow-hidden bg-stone-100 relative shrink-0`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt={post.title} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${post.slug === 'matias-turchi' ? 'object-top' : 'object-center'}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-6 lg:p-8 flex-1 flex flex-col relative bg-white dark:bg-stone-900 h-full">
                  <div className="flex items-center gap-2 mb-3 -mt-10 lg:-mt-12 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white bg-primary px-3 py-1.5 rounded-full shadow-lg">
                      {post.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-stone-400 font-medium">
                      {new Date(post.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <h2 className={`${titleSize} font-black text-stone-800 dark:text-stone-100 mb-3 group-hover:text-primary transition-colors line-clamp-3 leading-tight`}>
                    {post.title}
                  </h2>
                  {showExcerpt && (
                    <p className={`text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4 flex-1 ${excerptLines}`}>
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-auto flex items-center text-sm font-bold text-primary group-hover:gap-2 transition-all">
                    Leer artículo <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            );

            acc.push(postElement);

            // Intercalate visual block
            if (index > 0 && index % 4 === 0) {
              const vIndex = (index / 4) - 1;
              if (vIndex < visualBlocks.length) {
                const visualElement = (
                  <div key={`visual-${index}`} className="group col-span-1 md:col-span-1 lg:col-span-1 row-span-1 rounded-3xl overflow-hidden relative shadow-sm hover:shadow-xl transition-all duration-300 bg-stone-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={visualBlocks[vIndex]} alt="Atelier Lifestyle" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
                    <div className="absolute inset-0 bg-stone-900/10 group-hover:bg-transparent transition-colors duration-300" />
                    <div className="absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">
                        Atelier Lifestyle
                      </p>
                    </div>
                  </div>
                );
                acc.push(visualElement);
              }
            }
            
            return acc;
          }, [] as React.ReactNode[])}
        </div>
      </div>
      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
