import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { StorefrontNavbar } from '@/components/Storefront/StorefrontNavbar';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { categoriasConPosts, postsDeCategoria } from '@/lib/blog-categorias';

export const revalidate = 300;

const SITIO = 'https://atelieroptica.com.ar';

// Una página por categoría en el build: son pocas y cambian poco, así entran al
// sitemap y Google las puede indexar como secciones propias.
export async function generateStaticParams() {
    const categorias = await categoriasConPosts();
    return categorias.map(c => ({ categoria: c.slug }));
}

export async function generateMetadata(
    { params }: { params: Promise<{ categoria: string }> },
): Promise<Metadata> {
    const { categoria } = await params;
    const grupo = await postsDeCategoria(categoria);
    if (!grupo) return { title: 'Categoría no encontrada' };

    const titulo = `${grupo.nombre} — Blog de Atelier Óptica`;
    const descripcion = `${grupo.posts.length} ${grupo.posts.length === 1 ? 'nota' : 'notas'} sobre ${grupo.nombre.toLowerCase()}: guías y consejos de nuestros ópticos en Córdoba.`;

    return {
        title: titulo,
        description: descripcion,
        alternates: { canonical: `${SITIO}/blog/categoria/${categoria}` },
        openGraph: {
            title: titulo,
            description: descripcion,
            type: 'website',
            url: `${SITIO}/blog/categoria/${categoria}`,
            // La foto de la primera nota puede ser vertical o cuadrada: al
            // compartir el link, WhatsApp la recorta y sale cualquier cosa. Se
            // usa la única imagen del sitio que ya está en 1200×630.
            images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: titulo }],
        },
    };
}

export default async function CategoriaDeBlogPage(
    { params }: { params: Promise<{ categoria: string }> },
) {
    const { categoria } = await params;
    const grupo = await postsDeCategoria(categoria);

    // Una categoría inexistente tiene que dar 404 de verdad, no una página vacía
    // con estado 200 (Google lo trata como soft-404 y la indexa igual).
    if (!grupo) notFound();

    const otras = (await categoriasConPosts()).filter(c => c.slug !== categoria);

    const listaLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${grupo.nombre} — Blog de Atelier Óptica`,
        url: `${SITIO}/blog/categoria/${categoria}`,
        mainEntity: {
            '@type': 'ItemList',
            numberOfItems: grupo.posts.length,
            itemListElement: grupo.posts.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITIO}/blog/${p.slug}`,
                name: p.title,
            })),
        },
    };

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 pb-20">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listaLd) }} />
            <StorefrontNavbar theme="light" />

            {/* Sin id: #main-content ya lo usa el div del layout raíz. */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 lg:pt-36">
                <Link
                    href="/blog"
                    className="inline-flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-primary transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver al blog
                </Link>

                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary mb-3">
                    Categoría
                </p>
                <h1 className="text-4xl lg:text-6xl font-black text-stone-800 dark:text-stone-100 tracking-tight mb-4">
                    {grupo.nombre}
                </h1>
                <p className="text-stone-600 dark:text-stone-400 text-lg mb-12">
                    {grupo.posts.length} {grupo.posts.length === 1 ? 'nota' : 'notas'} escritas por nuestros ópticos.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {grupo.posts.map((post, index) => (
                        <Link
                            key={post.slug}
                            href={`/blog/${post.slug}`}
                            className="group bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 overflow-hidden flex flex-col"
                        >
                            <div className="h-52 w-full overflow-hidden bg-stone-100 relative shrink-0">
                                <Image
                                    unoptimized={String(post.imageUrl || '').startsWith('data:')}
                                    src={post.imageUrl || '/images/blog/blog1_header.png'}
                                    alt={post.title}
                                    fill
                                    priority={index < 3}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
                                />
                            </div>
                            <div className="p-6 lg:p-8 flex-1 flex flex-col">
                                <span className="text-xs text-stone-400 font-medium mb-2">
                                    {new Date(post.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                                <h2 className="text-xl font-black text-stone-800 dark:text-stone-100 mb-3 group-hover:text-primary transition-colors line-clamp-3 leading-tight">
                                    {post.title}
                                </h2>
                                <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">
                                    {post.excerpt}
                                </p>
                                <div className="mt-auto flex items-center text-sm font-bold text-primary group-hover:gap-2 transition-all">
                                    Leer nota <ArrowRight className="w-4 h-4 ml-1" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {otras.length > 0 && (
                    <div className="mt-20">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 mb-5">
                            Otras categorías
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {otras.map(c => (
                                <Link
                                    key={c.slug}
                                    href={`/blog/categoria/${c.slug}`}
                                    className="text-xs font-bold px-4 py-2 rounded-full border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:border-primary hover:text-primary transition-colors"
                                >
                                    {c.nombre} <span className="text-stone-400">({c.cantidad})</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <StorefrontFooter />
        </div>
    );
}
