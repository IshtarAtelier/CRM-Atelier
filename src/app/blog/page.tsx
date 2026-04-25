import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: "Blog de Salud Visual y Novedades | Atelier Óptica Córdoba",
  description: "Descubrí consejos sobre salud visual, multifocales, anteojos recetados y lo último en tendencias de gafas de sol en Córdoba.",
};

const posts = [
  {
    slug: 'guia-multifocales-cordoba',
    title: 'Lentes Multifocales en Córdoba: Todo lo que necesitas saber',
    excerpt: '¿Qué son los cristales multifocales y cómo elegir los mejores para tu visión? Consejos para una adaptación rápida y sin mareos.',
    date: '2026-04-20',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1577803645773-f96470509666?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'elegir-anteojos-recetados',
    title: 'Cómo elegir anteojos recetados según la forma de tu cara',
    excerpt: 'Guía definitiva para comprar anteojos recetados que combinen con tu estilo y te brinden la mejor comodidad óptica.',
    date: '2026-04-15',
    category: 'Tendencias',
    imageUrl: 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'optica-cordoba-cerro-de-las-rosas',
    title: 'Por qué somos la óptica recomendada en Cerro de las Rosas',
    excerpt: 'Conocé Atelier Óptica, especialistas en atención personalizada, armazones de diseño y cristales de alta precisión en Córdoba.',
    date: '2026-04-10',
    category: 'Nuestra Óptica',
    imageUrl: 'https://images.unsplash.com/photo-1555505019-8c3f1c4aba5f?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'lentes-de-sol-tendencias-2026',
    title: 'Lentes de Sol en Córdoba: Tendencias 2026 y Protección UV',
    excerpt: 'Descubrí los armazones que son furor este año y por qué el filtro UV400 es innegociable para cuidar tu vista.',
    date: '2026-04-25',
    category: 'Tendencias',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'como-leer-tu-receta-oftalmologica',
    title: 'Cómo leer tu receta oftalmológica paso a paso',
    excerpt: '¿Qué significan Esfera, Cilindro, Eje y Adición? Te explicamos de forma sencilla cómo interpretar lo que te recetó el oftalmólogo.',
    date: '2026-04-22',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1582685116743-69022ee01509?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'filtro-azul-pantallas',
    title: 'Filtro Azul (Blue Light Cut): ¿Mito o necesidad si trabajás frente a pantallas?',
    excerpt: 'Si sentís fatiga visual o dolores de cabeza después de tu jornada de trabajo, enterate por qué los cristales con filtro azul son fundamentales.',
    date: '2026-04-26',
    category: 'Tecnología',
    imageUrl: 'https://images.unsplash.com/photo-1542626991-cbc4e32524cc?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'cristales-fotocromaticos-transitions',
    title: 'Cristales Fotocromáticos: Todo sobre los lentes que se oscurecen con el sol',
    excerpt: 'Comodidad total: lentes recetados en el interior y lentes de sol en el exterior. Descubrí cómo funciona la tecnología fotocromática.',
    date: '2026-04-27',
    category: 'Cristales',
    imageUrl: 'https://images.unsplash.com/photo-1572631382901-cf1a0a6087cb?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'anteojos-para-ninos',
    title: 'Anteojos para niños: ¿Cuándo hacer el primer control visual?',
    excerpt: 'Señales de alerta de que tu hijo necesita lentes y qué armazones infantiles (flexibles e irrompibles) son los más recomendados.',
    date: '2026-04-28',
    category: 'Pediatría',
    imageUrl: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'como-limpiar-tus-anteojos',
    title: 'Guía definitiva para limpiar tus anteojos sin rayar el antirreflex',
    excerpt: 'El error más común es usar la remera o servilletas de papel. Aprendé los pasos correctos para que tus cristales duren años como nuevos.',
    date: '2026-04-29',
    category: 'Mantenimiento',
    imageUrl: 'https://images.unsplash.com/photo-1510425409890-50dce4211a37?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'multifocales-marcas-precios-varilux-novar',
    title: 'Marcas de Multifocales en Argentina: ¿Qué diferencias hay entre Varilux, Novar y genéricos?',
    excerpt: 'Comparativa definitiva sobre campos visuales, tecnologías de tallado digital y por qué el precio de un multifocal varía tanto.',
    date: '2026-05-02',
    category: 'Cristales',
    imageUrl: 'https://images.unsplash.com/photo-1589828138980-0010996841e2?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'mareos-con-multifocales-soluciones',
    title: '¿Tus multifocales te marean? Causas principales y cómo solucionarlo',
    excerpt: 'Si sentís que el piso se mueve o te duele la cabeza al usar progresivos, te contamos por qué pasa y cómo lo calibramos para solucionarlo.',
    date: '2026-05-04',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1605652157522-83b1bb649c0c?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
    title: 'Por qué nuestros multifocales no fallan: Tecnología de medición en Córdoba',
    excerpt: 'Hacer un lente progresivo perfecto requiere mucho más que una receta. Conocé nuestro proceso de toma de medidas de alta precisión para una adaptación garantizada.',
    date: '2026-05-06',
    category: 'Nuestra Óptica',
    imageUrl: 'https://images.unsplash.com/photo-1579684453401-9cc5825bc531?q=80&w=800&auto=format&fit=crop'
  },
  {
    slug: 'pasos-faciles-adaptacion-multifocales',
    title: '3 Pasos Fáciles para Adaptarte a tus Multifocales (Sin Estrés)',
    excerpt: 'Acostumbrarse a los lentes progresivos es mucho más natural de lo que parece. Seguí estos 3 simples pasos y empezá a disfrutar de una visión perfecta.',
    date: '2026-05-08',
    category: 'Salud Visual',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800&auto=format&fit=crop'
  }
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
      <div className="bg-primary/5 py-16 lg:py-24 border-b border-primary/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-black text-stone-900 dark:text-white tracking-tight mb-4">
            Blog <span className="text-primary italic">Atelier</span>
          </h1>
          <p className="text-lg text-stone-600 dark:text-stone-400 max-w-2xl mx-auto">
            Noticias, consejos de salud visual y guías sobre anteojos y multifocales en Córdoba.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 overflow-hidden flex flex-col">
              <div className="h-48 w-full overflow-hidden bg-stone-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div className="p-8 flex-1 flex flex-col relative bg-white dark:bg-stone-900">
                <div className="flex items-center gap-2 mb-4 -mt-12 relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white bg-primary px-3 py-1.5 rounded-full shadow-lg">
                    {post.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-stone-400 font-medium">
                    {new Date(post.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                  {post.excerpt}
                </p>
                <div className="flex items-center text-sm font-bold text-primary group-hover:gap-2 transition-all">
                  Leer artículo <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
