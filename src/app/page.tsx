import Link from "next/link";
import { Metadata } from "next";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { FilmmakerReel } from "@/components/Storefront/FilmmakerReel";
import dynamic from "next/dynamic";
const StorefrontFooter = dynamic(() => import("@/components/Storefront/StorefrontFooter").then(mod => mod.StorefrontFooter));
const FloatingWhatsApp = dynamic(() => import("@/components/Storefront/FloatingWhatsApp").then(mod => mod.FloatingWhatsApp));
const GoogleReviews = dynamic(() => import("@/components/Storefront/GoogleReviews").then(mod => mod.GoogleReviews));
const HomeProductCarousel = dynamic(() => import("@/components/Storefront/HomeProductCarousel").then(mod => mod.HomeProductCarousel));
const HomeConfiguratorSection = dynamic(() => import("@/components/Storefront/HomeConfiguratorSection").then(mod => mod.HomeConfiguratorSection));
const HomeMacroFilm = dynamic(() => import("@/components/Storefront/HomeMacroFilm").then(mod => mod.HomeMacroFilm));
const HomeStorePreview = dynamic(() => import("@/components/Storefront/HomeStorePreview").then(mod => mod.HomeStorePreview));
const HomeWhyChooseUs = dynamic(() => import("@/components/Storefront/HomeWhyChooseUs").then(mod => mod.HomeWhyChooseUs));
const HomeRecommendationQuiz = dynamic(() => import("@/components/Storefront/HomeRecommendationQuiz").then(mod => mod.HomeRecommendationQuiz));

import { prisma } from "@/lib/db";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { getGoogleReviews } from "@/lib/googleReviews";
import { getWebSettings, defaultWebSettings } from "@/lib/web-settings";
import { BUSINESS_INFO } from "@/lib/business-info";
import { buildOpticianSchema } from "@/lib/schema";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Atelier Óptica | Anteojos, Cristales y Multifocales en Cuotas",
  description: "Atelier Óptica en Córdoba. Especialistas en anteojos de receta, lentes de sol, y multifocales Varilux. Envíos a todo el país y presupuestos rápidos por WhatsApp.",
  alternates: {
    canonical: 'https://atelieroptica.com.ar',
  },
  openGraph: {
    title: "Atelier Óptica | Anteojos, Cristales y Multifocales en Cuotas",
    description: "Especialistas en anteojos de receta, lentes de sol, y multifocales Varilux. Envíos a todo el país y presupuestos por WhatsApp.",
    url: 'https://atelieroptica.com.ar',
    type: 'website',
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630 }],
  },
};

// ==========================================
// ATELIER ÓPTICA — GENTLE MONSTER REPLICA
// Estructura exacta: Hero cinematográfico
// + Horizontal product scroll + Footer simple
// ==========================================

const PRODUCTS = [
  { id: 1, name: "Atelier 9030(GLD)", price: "6 cuotas de $9.167", img: "/images/products/atelier-9030-gold.png", slug: "atelier-carey-vintage" },
  { id: 2, name: "Rosé Cat Eye(PNK)", price: "6 cuotas de $8.000", img: "/images/products/cateye-rose.png", slug: "atelier-carey-vintage" },
  { id: 3, name: "Pantos Blush(RSE)", price: "6 cuotas de $7.500", img: "/images/products/pantos-pink.png", slug: "atelier-carey-vintage" },
  { id: 4, name: "Mistral Manglares(BRD)", price: "6 cuotas de $8.667", img: "/images/products/mistral-manglares.png", slug: "atelier-carey-vintage" },
  { id: 5, name: "Cima Dreamy(CRL)", price: "6 cuotas de $9.667", img: "/images/products/cima-dreamy.png", slug: "atelier-carey-vintage" },
];

export default async function Home() {
  // 1. Server-Side Data Fetching from WebProduct to get Goddess names and slugs
  let dbWebProducts: any[] = [];
  let solProducts: any[] = [];
  let recetaProducts: any[] = [];
  let nuevosProducts: any[] = [];
  let totalCatalogCount: number = 120;

  // Solo los campos que usa formatProducts (evita traer la fila completa del producto → HTML más liviano)
  const PRODUCT_SELECT = {
    name: true,
    imageUrl: true,
    images: true,
    slug: true,
    product: {
      select: {
        id: true,
        price: true,
        stock: true,
        model: true,
        category: true,
        imagenesCatalogo: true,
      },
    },
  };

  // Reseñas de Google y settings web en paralelo con las consultas de productos (antes bloqueaban en serie)
  const reviewsPromise = getGoogleReviews();
  const webSettingsPromise = getWebSettings().catch(() => defaultWebSettings);

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      dbWebProducts = await prisma.webProduct.findMany({
        where: {
          isActive: true,
          isFeatured: true, // Only display featured products in the homepage carousel
          product: {
            publishToWeb: true,
            category: { not: 'Cristal' }
          }
        },
        select: PRODUCT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 24 // Fetch more to allow for deduplication
      });
      
      const [dbSol, dbReceta, dbNuevos, count] = await Promise.all([
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: 'Lentes de Sol' } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: 'desc' },
          take: 24
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: 'Armazón de Receta' } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: 'desc' },
          take: 24
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: 'desc' },
          take: 24
        }),
        prisma.webProduct.count({
          where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } }
        })
      ]);

      solProducts = dbSol;
      recetaProducts = dbReceta;
      nuevosProducts = dbNuevos;
      totalCatalogCount = count;
      break; // Success — exit retry loop
    } catch (error) {
      console.error(`[Home] DB query attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * attempt)); // Backoff: 500ms, 1s, 1.5s
      } else {
        // Si la DB no responde, lanzar en vez de cachear el home vacío:
        // con ISR, Next conserva la última versión buena de la página.
        throw error;
      }
    }
  }

  // Formateamos los productos para el carrusel y evitamos variantes repetidas
  const formatProducts = (list: any[]) => {
    if (!list || list.length === 0) return [];
    
    const formatted = list.map(wp => ({
      id: wp.product.id,
      name: wp.name,
      rawPrice: wp.product.price,
      price: wp.product.price ? `6 cuotas de $${Math.round(wp.product.price / 6).toLocaleString("es-AR")}` : "",
      img: wp.imageUrl 
        ? resolveStorageUrl(wp.imageUrl)
        : (wp.images.length > 0 
            ? resolveStorageUrl(wp.images[0])
            : (wp.product.imagenesCatalogo.length > 0 ? resolveStorageUrl(wp.product.imagenesCatalogo[0]) : '/images/og-image.jpg')),
      slug: wp.slug,
      stock: wp.product.stock,
      brand: 'ATELIER',
      model: wp.product.model,
      secondImg: wp.images.length > 1 
        ? resolveStorageUrl(wp.images[1])
        : (wp.product.imagenesCatalogo.length > 1 ? resolveStorageUrl(wp.product.imagenesCatalogo[1]) : null),
      category: wp.product.category
    }));

    // Deduplicate variants (e.g. "Frida C1" and "Frida C5" -> only keep first)
    const uniqueBaseNames = new Set<string>();
    const deduplicated = formatted.filter(p => {
      const match = (p.model || p.name).match(/(.*)\s+(c\d+)\b/i);
      const baseName = match ? match[1].trim().toLowerCase() : (p.model || p.name).toLowerCase();
      
      if (uniqueBaseNames.has(baseName)) return false;
      uniqueBaseNames.add(baseName);
      return true;
    });

    return deduplicated.slice(0, 12);
  };

  const carouselData = {
    destacados: formatProducts(dbWebProducts),
    sol: formatProducts(solProducts),
    receta: formatProducts(recetaProducts),
    nuevos: formatProducts(nuevosProducts),
  };
  
  const catalogCount = totalCatalogCount;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": BUSINESS_INFO.name,
    "url": "https://atelieroptica.com.ar",
    "logo": "https://atelieroptica.com.ar/assets/logo-pwa-512.png",
    "sameAs": [BUSINESS_INFO.instagramUrl, BUSINESS_INFO.youtubeUrl],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": BUSINESS_INFO.phoneE164,
      "contactType": "customer service",
      "availableLanguage": "Spanish"
    }
  };

  const reviewsData = await reviewsPromise;
  const webSettings = await webSettingsPromise;

  // El builder omite aggregateRating si rating/count no son reales (> 0)
  const localBusinessSchema = buildOpticianSchema({
    aggregateRating: { rating: reviewsData.rating, count: reviewsData.userRatingCount },
  });

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Atelier Óptica",
    "url": "https://atelieroptica.com.ar",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://atelieroptica.com.ar/tienda?q={search_term}",
      "query-input": "required name=search_term"
    }
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": dbWebProducts.map((wp, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://atelieroptica.com.ar/producto/${wp.slug}`,
      "name": wp.name,
      "image": wp.imageUrl 
        ? resolveStorageUrl(wp.imageUrl) 
        : (wp.images?.length > 0 ? resolveStorageUrl(wp.images[0]) : "https://atelieroptica.com.ar/assets/logo-pwa-512.png")
    }))
  };

  return (
    <div className="bg-white text-black selection:bg-black selection:text-white overflow-x-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }} />
      {dbWebProducts.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      )}
      
      {/* ═══════════════════════════════════════════════ */}
      {/* NAV — Replica exacta de Gentle Monster          */}
      {/* ═══════════════════════════════════════════════ */}
      <StorefrontNavbar theme="dark" initialSettings={webSettings} />

      {/* ═══════════════════════════════════════════════ */}
      {/* FILMMAKER REEL — Hero principal cinematográfico   */}
      {/* ═══════════════════════════════════════════════ */}
      <FilmmakerReel reviewCount={reviewsData.userRatingCount} rating={reviewsData.rating} />

      <h1 className="sr-only">Atelier Óptica Córdoba — Anteojos de Receta, Lentes de Sol y Multifocales</h1>

      {/* ═══════════════════════════════════════════════ */}
      {/* MARQUEE — Texto deslizante entre secciones      */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="w-full bg-black border-y border-white/10 py-3 overflow-hidden">
        <div
          className="flex w-max gap-0"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[...Array(2)].map((_, i) => (
            <span key={i} className="flex items-center gap-8 pr-8 text-[11px] font-bold uppercase tracking-[0.25em] text-white/60 whitespace-nowrap">
              <span>Colección de Diseño</span>
              <span className="text-white/20">·</span>
              <span>Acetato Italiano</span>
              <span className="text-white/20">·</span>
              <span>Hechos para destacar tu mirada</span>
              <span className="text-white/20">·</span>
              <span>Curaduría Exclusiva</span>
              <span className="text-white/20">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* LATEST — Título + Catálogo horizontal scroll    */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="w-full bg-white pt-16 pb-8">
        <div className="px-5 mb-2">
          <h2 className="text-[13px] font-bold tracking-normal uppercase">
            LO NUEVO DE ATELIER
          </h2>
          <Link href="/tienda" className="text-[13px] font-medium underline underline-offset-4 decoration-1 hover:opacity-60 transition-opacity mt-1 inline-block">
            VER MÁS
          </Link>
        </div>
      </section>

      {/* PRODUCT GRID — Scroll horizontal infinito en Cliente */}
      <HomeProductCarousel collections={carouselData} totalCount={catalogCount} />

      {/* ═══════════════════════════════════════════════ */}
      {/* GOOGLE REVIEWS (REAL TIME - Server Component)   */}
      {/* ═══════════════════════════════════════════════ */}
      <GoogleReviews />

      {/* ═══════════════════════════════════════════════ */}
      {/* POR QUÉ ELEGIRNOS — Pilares de Confianza         */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeWhyChooseUs />

      {/* ═══════════════════════════════════════════════ */}
      {/* CONFIGURADOR CTA — Nuestra diferencia vs GM     */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeConfiguratorSection />

      {/* ═══════════════════════════════════════════════ */}
      {/* CINEMATIC MACRO FILM LOOP (HOME)                */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeMacroFilm />

      {/* ASISTENTE RECOMENDADOR / QUIZ */}
      <HomeRecommendationQuiz />

      {/* ═══════════════════════════════════════════════ */}
      {/* LOCAL PREVIEW — Boutique Cerro de las Rosas     */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeStorePreview />

      {/* ═══════════════════════════════════════════════ */}
      {/* FOOTER Y WIDGETS                               */}
      {/* ═══════════════════════════════════════════════ */}
      <StorefrontFooter />
      

    </div>
  );
}
