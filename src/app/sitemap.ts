import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { categoriasConPosts } from '@/lib/blog-categorias';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://atelieroptica.com.ar';

  const staticRoutes = [
    '',
    '/tienda',
    '/quienes-somos',
    '/como-comprar',
    '/politicas-de-cambio',
    '/faq',
    '/contacto',
    '/nuestro-local',
    '/optica-cordoba',
    // La página del producto que más factura. Va en el sitemap porque, a
    // diferencia de las landings de campaña (/landing/*, que son noindex),
    // ésta existe justamente para captar a quien busca "multifocales".
    '/multifocales',
    '/lentes-de-sol',
    '/receta',
    '/lentes-de-contacto',
    '/cristales-opticos/varilux',
    '/cristales-opticos/antirreflejo',
    '/cristales-opticos/crizal',
    '/cristales-opticos/transitions',
    '/cristales-opticos/blue-uv',
    '/cristales-opticos/super-blue',
    '/cristales-opticos/eyezen',
    '/cristales-opticos/stellest',
    '/cristales-opticos/myofix',
    '/cristales-opticos/policarbonato',
    '/cristales-opticos/kodak',
    '/cristales-opticos/xperio',
    '/clip-on',
    '/resenas',
    '/blog',
    '/blog/faq',
    '/arma-tus-lentes',
    '/urgencias',
    '/obras-sociales',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const physicalBlogRoutes = [
    '/blog/anteojos-obras-de-arte',
    '/blog/colores-cristales',
    '/blog/como-leer-receta-oftalmologica',
    '/blog/como-limpiar-anteojos-sin-rayar',
    '/blog/control-miopia',
    '/blog/control-miopia-infantil-lentes',
    '/blog/diferencia-miopia-hipermetropia-astigmatismo',
    '/blog/filtro-azul-vs-antirreflejo',
    '/blog/guia-armazones-segun-rostro',
    '/blog/guia-cristales',
    '/blog/guia-precios-multifocales-argentina',
    '/blog/lentes-fotocromaticos-transitions',
    '/blog/lentes-polarizados-vs-comunes',
    '/blog/materiales-armazones-acetato-tr90',
    '/blog/matias-turchi',
    '/blog/mitos-lentes-contacto',
    '/blog/optica-mejor-calificada-cordoba',
    '/blog/peligros-anteojos-pregraduados-farmacia',
    '/blog/por-que-no-pegar-anteojos-la-gotita',
    '/blog/sintomas-presbicia-soluciones',
    '/blog/varilux-vs-kodak-vs-zeiss',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.75,
  }));

  const fallbackBlogSlugs = [
    'lentes-eyezen-boost-cordoba',
    'ray-ban-meta-smart-glasses-cordoba',
    'lentes-wicue-oscurecen-con-boton',
    'tratamiento-antirreflex-crizal-sapphire',
    'lentes-eyezen-descanso-pantallas-essilor',
    'lentes-stellest-control-miopia-infantil',
    'varilux-xr-series-inteligencia-artificial',
    'varilux-comfort-max-dolor-de-cuello',
    'varilux-vs-genericos-diferencias',
    'mejor-optica-multifocales-cordoba',
    'precio-multifocales-cordoba-2026',
    'optica-exclusiva-cerro-rosas-cordoba',
    'multifocales-primera-vez-guia-cordoba',
    'multifocales-trabajo-oficina-cordoba',
    'guia-multifocales-cordoba',
    'elegir-anteojos-recetados',
    'optica-cordoba-cerro-de-las-rosas',
    'lentes-de-sol-tendencias-2026',
    'como-leer-tu-receta-oftalmologica',
    'filtro-azul-pantallas',
    'anteojos-para-ninos',
    'como-limpiar-tus-anteojos',
    'multifocales-marcas-precios-varilux-novar',
    'mareos-con-multifocales-soluciones',
    'por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
    'pasos-faciles-adaptacion-multifocales',
    'bifocales-vs-multifocales-diferencias',
    'multifocales-ocupacionales-para-computadora',
    'experiencia-boutique-atelier-optica',
    'diseno-y-marcas-armazones-cordoba'
  ];

  const fallbackBlogRoutes = fallbackBlogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Fetch dynamic blog posts from Database
  let dbBlogRoutes: any[] = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true }
    });
    dbBlogRoutes = blogPosts
      // Los artículos importados de Tienda Nube conservan en la DB su slug con
      // sufijo hash y siguen PUBLISHED, pero /blog/[slug] los redirige (301) a
      // su versión con slug limpio, que también está en este sitemap. Un sitemap
      // debe listar solo destinos finales: declararlos hacía que Google los
      // rastreara y los contara como "Página con redirección" (17 casos en el
      // aviso de Search Console del 18/7/2026). Mismo criterio que usa
      // HASH_SUFFIX_REGEX en src/app/blog/[slug]/page.tsx.
      .filter((post) => !/-[0-9a-f]{12}$/.test(post.slug))
      .map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error("Error fetching sitemap blog routes from DB:", error);
  }

  // Secciones del blog por tema (/blog/categoria/salud-visual). Son pocas y
  // agrupan las 51 notas por asunto: Google indexa una página por tema en vez de
  // depender de que llegue a cada nota suelta.
  let categoriaRoutes: any[] = [];
  try {
    const categorias = await categoriasConPosts();
    categoriaRoutes = categorias.map((c) => ({
      url: `${baseUrl}/blog/categoria/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error('Error armando las categorías del blog para el sitemap:', error);
  }

  // Fetch dynamic products
  let productRoutes: any[] = [];
  try {
    const products = await prisma.webProduct.findMany({
      // Espejamos el catálogo: solo lo publicado y sin Cristal, para no indexar
      // URLs que la ficha redirige o que no representan productos comprables.
      where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
      select: { slug: true, updatedAt: true, product: { select: { imagenesCatalogo: true } } }
    });
    productRoutes = products.map((product) => {
      // La imagen declarada en el sitemap es lo que habilita a la ficha a
      // aparecer en Google Imágenes, que para anteojos es tráfico real: la
      // gente busca el armazón mirando, no leyendo.
      const primera = product.product?.imagenesCatalogo?.find((i) => typeof i === 'string' && i.length > 0);
      return {
        url: `${baseUrl}/producto/${product.slug}`,
        lastModified: product.updatedAt,
        changeFrequency: 'daily' as const,
        priority: 0.9,
        ...(primera
          ? { images: [primera.startsWith('http') ? primera : `${baseUrl}${primera}`] }
          : {}),
      };
    });
  } catch (error) {
    console.error("Error fetching sitemap product routes from DB:", error);
  }

  // Las 48 `/blog/busquedas/<keyword>` NO van más en el sitemap: desde el
  // 9/8/2026 redirigen 301 a la página real que responde cada búsqueda (ver
  // src/app/blog/busquedas/[query]/page.tsx). Un sitemap declara destinos
  // finales; ofrecer redirecciones para indexar es el mismo error que ya costó
  // 17 avisos de "Página con redirección" el 18/7 con los slugs de Tienda Nube.
  // Además eran doorway pages, que es riesgo de acción manual.

  // Dedupe por URL — los posts de DB pisan a los fallbacks hardcodeados
  // (traen lastModified real) y evitamos las ~30 entradas duplicadas del blog.
  const byUrl = new Map<string, any>();
  for (const route of [
    ...staticRoutes,
    ...physicalBlogRoutes,
    ...fallbackBlogRoutes,
    ...dbBlogRoutes,
    ...categoriaRoutes,
    ...productRoutes,
  ]) {
    byUrl.set(route.url, route);
  }
  return Array.from(byUrl.values());
}

