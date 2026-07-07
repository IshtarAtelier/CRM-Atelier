import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { seoKeywords } from '@/lib/seo-keywords';

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
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const physicalBlogRoutes = [
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
    dbBlogRoutes = blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error("Error fetching sitemap blog routes from DB:", error);
  }

  // Fetch dynamic products
  let productRoutes: any[] = [];
  try {
    const products = await prisma.webProduct.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true }
    });
    productRoutes = products.map((product) => ({
      url: `${baseUrl}/producto/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    }));
  } catch (error) {
    console.error("Error fetching sitemap product routes from DB:", error);
  }

  const seoKeywordRoutes = seoKeywords.map((keyword) => ({
    url: `${baseUrl}/blog/busquedas/${keyword}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dedupe por URL — los posts de DB pisan a los fallbacks hardcodeados
  // (traen lastModified real) y evitamos las ~30 entradas duplicadas del blog.
  const byUrl = new Map<string, any>();
  for (const route of [
    ...staticRoutes,
    ...physicalBlogRoutes,
    ...fallbackBlogRoutes,
    ...dbBlogRoutes,
    ...productRoutes,
    ...seoKeywordRoutes,
  ]) {
    byUrl.set(route.url, route);
  }
  return Array.from(byUrl.values());
}

