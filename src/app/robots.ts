import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://atelieroptica.com.ar';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/login/', '/checkout/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
