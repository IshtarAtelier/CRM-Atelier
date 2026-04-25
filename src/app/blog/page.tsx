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
