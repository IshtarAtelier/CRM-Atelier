import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.atelieroptica.com.ar';

  const staticRoutes = [
    '',
    '/tienda',
    '/quienes-somos',
    '/como-comprar',
    '/politicas-de-cambio',
    '/contacto',
    '/nuestro-local',
    '/lentes-de-sol',
    '/receta',
    '/lentes-de-contacto',
    '/cristales-opticos',
    '/clip-on',
    '/resenas',
    '/blog'
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const blogSlugs = [
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
    'cristales-fotocromaticos-transitions',
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

  const blogRoutes = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  // Fetch dynamic products
  const products = await prisma.webProduct.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true }
  });

  const productRoutes = products.map((product) => ({
    url: `${baseUrl}/producto/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...blogRoutes, ...productRoutes];
}
