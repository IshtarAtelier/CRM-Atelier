import { staticPosts } from '@/lib/static-blog-posts';
import { prisma } from '@/lib/db';

/**
 * Categorías del blog como direcciones propias.
 *
 * Los 51 artículos ya tenían link individual, pero la categoría que se muestra
 * en cada tarjeta no llevaba a ningún lado: para mandar "todo lo que escribimos
 * de Pediatría" había que pegar los cuatro links sueltos. Acá se resuelve el
 * nombre visible ⇄ el slug de la URL, una sola vez, para el listado, la página
 * de categoría y el sitemap.
 */

export type PostDeBlog = {
    slug: string;
    title: string;
    excerpt: string;
    imageUrl: string;
    category: string;
    date: string;
};

/** "Salud Visual" → "salud-visual" */
export function slugDeCategoria(nombre: string): string {
    return String(nombre || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Todos los posts publicados: los de la base primero, y los estáticos que no
 * fueron reemplazados por uno de la base (misma regla que /blog).
 */
export async function todosLosPosts(): Promise<PostDeBlog[]> {
    let dbPosts: any[] = [];
    try {
        dbPosts = await prisma.blogPost.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { date: 'desc' },
        });
    } catch (error) {
        // La página pública no puede caerse porque la base no responda: se sirve
        // con los estáticos, que viven en el bundle.
        console.error('[blog] no se pudieron leer los posts de la base:', error);
    }

    const deLaBase: PostDeBlog[] = dbPosts.map(p => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        imageUrl: p.imageUrl || '/images/blog/blog1_header.png',
        category: p.category,
        date: p.date.toISOString(),
    }));

    return [
        ...deLaBase,
        ...staticPosts.filter(sp => !deLaBase.some(dp => dp.slug === sp.slug)),
    ];
}

/** Categorías con al menos un post, ordenadas por cantidad. */
export async function categoriasConPosts(): Promise<
    { nombre: string; slug: string; cantidad: number }[]
> {
    const posts = await todosLosPosts();
    const cuenta = new Map<string, number>();
    for (const p of posts) {
        const nombre = (p.category || '').trim();
        if (!nombre) continue;
        cuenta.set(nombre, (cuenta.get(nombre) || 0) + 1);
    }
    return [...cuenta.entries()]
        .map(([nombre, cantidad]) => ({ nombre, slug: slugDeCategoria(nombre), cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
}

/** Los posts de una categoría, resolviendo por slug. null si la categoría no existe. */
export async function postsDeCategoria(
    slug: string,
): Promise<{ nombre: string; posts: PostDeBlog[] } | null> {
    const posts = await todosLosPosts();
    const delGrupo = posts.filter(p => slugDeCategoria(p.category || '') === slug);
    if (delGrupo.length === 0) return null;
    return { nombre: (delGrupo[0].category || '').trim(), posts: delGrupo };
}
