import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { dev }) => {
    // Re-enabled cache to prevent chunk mismatches and static assets 404s
    /*
    if (dev) {
      config.cache = false; // Disable cache in dev to prevent Next.js 15 MODULE_NOT_FOUND errors
    }
    */
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  },
  async redirects() {
    return [
      {
        source: '/blog/posts/lentes-filtro-luz-azul-home-office-cordoba-atelier-optica-85679646df21',
        destination: '/blog/filtro-azul-pantallas',
        permanent: true,
      },
      {
        source: '/blog/posts/anteojos-para-ninos-salud-visual-y-vuelta-al-cole-atelier-optica-cordoba-de24d54c7a83',
        destination: '/blog/anteojos-para-ninos',
        permanent: true,
      },
      {
        source: '/blog/posts/tendencias-anteojos-de-sol-2026-cordoba-atelier-optica-d67c205b4d5d',
        destination: '/blog/lentes-de-sol-tendencias-2026',
        permanent: true,
      },
      {
        source: '/blog/posts/lentes-progresivos-multifocales-cordoba-atelier-optica-c0e9ffcaefb9',
        destination: '/blog/guia-multifocales-cordoba',
        permanent: true,
      },
      {
        source: '/blog/posts/anteojos-segun-tipo-rostro-guia-cordoba-atelier-optica-588826877f03',
        destination: '/blog/elegir-anteojos-recetados',
        permanent: true,
      },
      {
        source: '/blog/posts/tendencias-en-anteojos-2026-marcos-colores-y-estilos-que-dominan-este-anio-09f7ade26e9d',
        destination: '/blog/diseno-y-marcas-armazones-cordoba',
        permanent: true,
      },
      {
        source: '/blog/posts/tratamiento-crizal-essilor-en-crdoba-2026-visin-clara-y-proteccin-total-6fd79b8ca784',
        destination: '/blog/multifocales-marcas-precios-varilux-novar',
        permanent: true,
      },
      {
        source: '/blog/posts/xperio-transitions-essilor-cordoba-2026-529a0209b715',
        destination: '/blog/cristales-fotocromaticos-transitions',
        permanent: true,
      },
      {
        source: '/blog/posts/varilux-liberty-3-0-cordoba-2026-5c5c684411a8',
        destination: '/blog/multifocales-primera-vez-guia-cordoba',
        permanent: true,
      },
      {
        source: '/blog/posts/varilux-physio-cordoba-2026-1c4afadee3eb',
        destination: '/blog/mejor-optica-multifocales-cordoba',
        permanent: true,
      },
      {
        source: '/blog/posts/varilux-comfort-max-cordoba-f11509d74771',
        destination: '/blog/pasos-faciles-adaptacion-multifocales',
        permanent: true,
      },
      {
        source: '/blog/posts/varilux-xr-series-cordoba-dcf372d4c673',
        destination: '/blog/por-que-nuestros-multifocales-no-fallan-tecnologia-cordoba',
        permanent: true,
      },
      {
        source: '/blog/posts/:slug',
        destination: '/blog',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
