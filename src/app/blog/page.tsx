import { Metadata } from "next";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { staticPosts } from "@/lib/static-blog-posts";
import { prisma } from "@/lib/db";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog de Salud Visual | Atelier Óptica Córdoba",
  description: "Guías, consejos y artículos escritos por expertos en óptica. Aprendé sobre presbicia, astigmatismo, miopía infantil, lectura de recetas y tecnologías de cristales.",
  keywords: ["blog salud visual", "como leer receta anteojos", "que es el filtro azul", "miopia infantil", "optica cordoba blog"],
};

export default async function BlogIndexPage() {
  let dbPosts: any[] = [];
  try {
    dbPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { date: 'desc' },
    });
  } catch (error) {
    console.error("Error loading blog posts from database:", error);
  }

  const mappedDbPosts = dbPosts.map(p => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category || "Guías",
    date: new Date(p.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }));

  const mappedStaticPosts = staticPosts.map(p => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    category: p.category || "Artículos",
    date: new Date(p.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }));

  const allPosts = [
    ...mappedDbPosts,
    ...mappedStaticPosts.filter(sp => !mappedDbPosts.some(dp => dp.slug === sp.slug))
  ];

  return (
    <div className="bg-[#faf8f5] text-black min-h-screen flex flex-col">
      <StorefrontNavbar theme="light" />
      
      <main className="flex-grow pt-32 pb-16">
        <section className="px-6 mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-[#e8e2db] text-black/60 text-sm font-medium tracking-tight tracking-widest uppercase mb-4">
              Atelier Journal
            </span>
            <h1 className="text-4xl md:text-6xl font-medium tracking-tight tracking-tight mb-6">
              Educación y Salud Visual
            </h1>
            <p className="text-lg text-black/60 md:text-xl max-w-2xl mx-auto">
              Respondemos con honestidad las preguntas más frecuentes sobre óptica, presbicia, tratamientos y tendencias.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {allPosts.map((post) => (
              <div key={post.slug} className="group flex flex-col bg-white rounded-2xl p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#e8e2db] hover:border-black/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-medium tracking-tight uppercase tracking-wider text-[#111]">
                    {post.category}
                  </span>
                  <span className="text-xs text-black/40">·</span>
                  <span className="text-xs text-black/40">{post.date}</span>
                </div>
                <h2 className="text-xl font-medium tracking-tight mb-3 group-hover:text-[#111] transition-colors line-clamp-2">
                  {post.title}
                </h2>
                <p className="text-black/60 mb-6 flex-grow line-clamp-3">
                  {post.excerpt}
                </p>
                <Link href={`/blog/${post.slug}`} className="inline-flex items-center text-sm font-medium tracking-tight text-black hover:opacity-60 transition-opacity">
                  Leer artículo →
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
