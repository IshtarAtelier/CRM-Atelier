import type { NextConfig } from "next";

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  // Permite aislar el build de medición de rendimiento (Lighthouse) del `.next`
  // del server de desarrollo en curso. Sin la env seteada, usa `.next` normal
  // (cero impacto en prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['playwright', 'firebase-admin', 'sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: 'https', hostname: '*.firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'promo.atelieroptica.com.ar' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'kazwiniopticalgroup.com' },
    ]
  },
  async rewrites() {
    return [
      // URL pública de la landing de campañas. Se sirve /landing pero la barra
      // del navegador queda en /promoanteojos: es la que va en los anuncios.
      //
      // Rewrite y no redirect a propósito: un 301 hace que el visitante llegue
      // a otra URL distinta de la del aviso, y encima suma un salto antes de
      // ver la página — en tráfico pago desde celular eso se paga en rebote.
      //
      // No se usa /promo porque esa ruta ya tiene la landing de la promo 2x1.
      { source: '/promoanteojos', destination: '/landing' },
      // Variantes: en un anuncio la URL se carga a mano una sola vez, y si se
      // escribe mal el clic pago cae en un 404. Ya pasó con /promoanteojo.
      { source: '/promoanteojo', destination: '/landing' },
      { source: '/promo-anteojos', destination: '/landing' },
      { source: '/promo-anteojo', destination: '/landing' },
      // Los feeds de catálogo viven bajo /api/, que robots.txt bloquea. Las
      // descargas programadas de Merchant y Commerce no respetan robots.txt,
      // así que hoy funcionan igual — pero cualquier validador o previsualización
      // que sí lo respete ve un feed prohibido. Estas URLs los dejan fuera de
      // /api/ sin mover la implementación.
      { source: '/feed/google.xml', destination: '/api/web/feed/google' },
      { source: '/feed/meta.xml', destination: '/api/web/feed/meta' },
    ];
  },
  async redirects() {
    // Redirect del dominio Railway al dominio real (sin www, como canonicaliza
    // el dominio vivo). APAGADO hasta el cutover DNS: se activa seteando
    // DOMAIN_CUTOVER=1 en Railway (el cambio de variable dispara redeploy).
    // Activarlo antes dejaría la tienda inaccesible (el dominio real todavía
    // sirve Tienda Nube).
    const cutoverRedirect = process.env.DOMAIN_CUTOVER === '1'
      ? [{
          source: '/:path*',
          has: [{ type: 'host' as const, value: 'crm-atelier-production-ae72.up.railway.app' }],
          destination: 'https://atelieroptica.com.ar/:path*',
          permanent: true,
        }]
      : [];
    return [
      ...cutoverRedirect,
      // www → apex. Los dos hosts servían 200: el mismo sitio en dos dominios,
      // con el visitante que llega por un link viejo con www quedándose ahí.
      // El <link rel="canonical"> ya apuntaba al apex (Google cubierto), pero
      // faltaba el 301 que mueve de verdad a la persona.
      {
        source: '/:path*',
        has: [{ type: 'host' as const, value: 'www.atelieroptica.com.ar' }],
        destination: 'https://atelieroptica.com.ar/:path*',
        permanent: true,
      },
      {
        source: '/politicas',
        destination: '/politicas-de-cambio',
        permanent: true,
      },
      // 🚀 REDIRECCIONES SEO DE TIENDANUBE -> NEXT.JS 🚀
      {
        source: '/productos',
        destination: '/tienda',
        permanent: true,
      },
      {
        source: '/productos/:slug',
        destination: '/producto/:slug',
        permanent: true,
      },
      // Paginación vieja de Tienda Nube (/<categoría>/page/N) para CUALQUIER
      // categoría: /lentes-de-sol/page/18 (Soft 404 en GSC), /receta/page/2, etc.
      // Cae en la categoría real con un 301 limpio. La app nueva no tiene rutas
      // /page/N, así que la regla no pisa nada.
      {
        source: '/:categoria/page/:num(\\d+)',
        destination: '/:categoria',
        permanent: true,
      },
      // Landing vieja de marcas Vulk & Rusty (404 en GSC). Se siguen vendiendo,
      // así que recuperamos el link mandándolo a la categoría de sol.
      {
        source: '/vulk-y-rusty',
        destination: '/lentes-de-sol',
        permanent: true,
      },
      // El G7013 C1 estaba cargado dos veces: quedó publicado Artemis y se
      // despublicó Halley. Su URL ya estaba indexada, así que en vez de un 404
      // la mandamos a la ficha que sobrevive.
      {
        source: '/producto/halley-c1',
        destination: '/producto/atelier-artemis-tendencia',
        permanent: true,
      },
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
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    // El panel admin de WhatsApp abre un socket.io contra el wa-service (otro
    // origen en Railway): sin esto, promover la CSP estricta rompería el tiempo real.
    const waUrl = process.env.NEXT_PUBLIC_WA_URL?.replace(/\/$/, '');
    const waOrigins = waUrl ? ` ${waUrl} ${waUrl.replace(/^https:/, 'wss:')}` : '';
    // CSP endurecida (sin wildcards en connect/frame, sin unsafe-eval en prod).
    // Corre como Report-Only junto a la CSP activa: loguea violaciones en la
    // consola del navegador sin bloquear nada. Cuando se valide en producción
    // (checkout Decidir incluido), promoverla a Content-Security-Policy.
    // Hosts de imágenes. Los cuatro últimos son los beacons de Meta y Google:
    // el Pixel manda sus eventos como <img>, así que si faltan acá la medición
    // se corta en silencio (no hay error visible, sólo dejan de llegar datos).
    // Se comparte entre la CSP activa y la Report-Only a propósito: estaban
    // duplicados y derivaron — la activa se quedó sin estos hosts y estuvo
    // bloqueando PageView, ViewContent y AddToCart.
    //
    // Los cuatro hosts de Google Ads (`googleadservices`, `googleads.g.doubleclick`,
    // `google.com` y `google.com.ar`) son la misma historia que los de Meta, un
    // año después: gtag manda la conversión a
    // `googleads.g.doubleclick.net/pagead/viewthroughconversion/…` y las listas
    // de remarketing a `google.com/ads/ga-audiences`, las dos como <img>/<script>.
    // Faltaban en la CSP, así que Google Ads no recibió NUNCA una conversión del
    // sitio ni pudo armar un público de remarketing — sin un solo error visible.
    // El ccTLD importa: un visitante argentino pega contra `google.com.ar`.
    // `h.online-metrix.net` es el fingerprinting de dispositivo (ThreatMetrix)
    // que carga el propio decidir.js de Payway para puntuar fraude. No estaba en
    // ninguna de las dos CSP, así que la ACTIVA lo bloqueaba —script e imagen—
    // en cada checkout: "The action has been blocked" en consola, y el análisis
    // antifraude de la pasarela corriendo a ciegas. Tercera vez que esta CSP
    // rompe una integración en silencio (Meta, Google Ads, y ahora pagos): el
    // host propio del proveedor va junto a los suyos que ya estaban permitidos.
    const imgSrc =
      "img-src 'self' data: blob: https://kazwiniopticalgroup.com https://*.firebasestorage.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://promo.atelieroptica.com.ar https://lh3.googleusercontent.com https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.com.ar https://h.online-metrix.net";
    // script-src también se comparte entre las dos CSP: estaba duplicado y es
    // exactamente así como la activa se quedó atrás la vez anterior.
    const scriptSrc = (allowEval: boolean) =>
      `script-src 'self' ${allowEval ? "'unsafe-eval' " : ""}'unsafe-inline' https://live.decidir.com https://developers.decidir.com https://h.online-metrix.net https://www.googletagmanager.com https://connect.facebook.net https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net`;
    const cspStrict = [
      "default-src 'self'",
      scriptSrc(isDev),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      imgSrc,
      "font-src 'self' data: https://fonts.gstatic.com",
      // `pagead2.googlesyndication.com` es el destino del ping de conversión que
      // gtag manda por fetch (`/ccm/collect`). Faltaba, así que la Report-Only
      // venía logueando una violación por página: nada se bloqueaba —la activa lo
      // permite por `https://*`— pero es exactamente la misma forma en que Meta y
      // Google Ads quedaron sin medir antes, y el día que esta política se
      // promueva a activa cortaría la conversión de verdad. Se agrega ahora, con
      // la política todavía en modo reporte, que es cuando sale gratis.
      `connect-src 'self' https://live.decidir.com https://developers.decidir.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://mercados.ambito.com${waOrigins}`,
      "frame-src 'self' https://maps.google.com https://www.google.com",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');
    // CSP activa: la de siempre, pero armada por partes en vez de un string
    // suelto. Mantiene los wildcards de connect/frame que necesita el checkout
    // de Decidir; lo único que cambió es que ahora comparte `imgSrc`.
    const cspActive = [
      "default-src 'self'",
      scriptSrc(true),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      imgSrc,
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://* wss://*",
      "frame-src 'self' https://*",
      "media-src 'self' https://cdn.pixabay.com",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Content-Security-Policy', value: cspActive },
          { key: 'Content-Security-Policy-Report-Only', value: cspStrict },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
