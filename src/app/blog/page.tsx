import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowRight, BookOpen } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { FloatingWhatsApp } from '@/components/Storefront/FloatingWhatsApp';
import { staticPosts } from '@/lib/static-blog-posts';

export const metadata: Metadata = {
  title: "Blog de Salud Visual y Novedades",
  description: "Descubrí consejos sobre salud visual, multifocales, anteojos recetados y lo último en tendencias de gafas de sol en Córdoba.",
  openGraph: {
    title: "Blog de Salud Visual y Novedades",
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

const posts = staticPosts;

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
