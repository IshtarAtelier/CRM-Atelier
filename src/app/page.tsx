import Link from "next/link";
import { Metadata } from "next";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { FilmmakerReel } from "@/components/Storefront/FilmmakerReel";
import dynamic from "next/dynamic";
const StorefrontFooter = dynamic(() => import("@/components/Storefront/StorefrontFooter").then(mod => mod.StorefrontFooter));
const FloatingWhatsApp = dynamic(() => import("@/components/Storefront/FloatingWhatsApp").then(mod => mod.FloatingWhatsApp));
const GoogleReviews = dynamic(() => import("@/components/Storefront/GoogleReviews").then(mod => mod.GoogleReviews));
const HomeProductCarousel = dynamic(() => import("@/components/Storefront/HomeProductCarousel").then(mod => mod.HomeProductCarousel));
import { HomeSolShowcase } from "@/components/Storefront/HomeSolShowcase";
const HomeConfiguratorSection = dynamic(() => import("@/components/Storefront/HomeConfiguratorSection").then(mod => mod.HomeConfiguratorSection));
const HomeMacroFilm = dynamic(() => import("@/components/Storefront/HomeMacroFilm").then(mod => mod.HomeMacroFilm));
const HomeStorePreview = dynamic(() => import("@/components/Storefront/HomeStorePreview").then(mod => mod.HomeStorePreview));
const HomeWhyChooseUs = dynamic(() => import("@/components/Storefront/HomeWhyChooseUs").then(mod => mod.HomeWhyChooseUs));
const HomeRecommendationQuiz = dynamic(() => import("@/components/Storefront/HomeRecommendationQuiz").then(mod => mod.HomeRecommendationQuiz));

import { getHomeProducts } from "@/lib/catalog/sources";
import { formatProducts } from "@/lib/home-fallback";
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

export default async function Home() {
  // Reseñas de Google y settings web en paralelo con las consultas de productos (antes bloqueaban en serie)
  const reviewsPromise = getGoogleReviews();
  const webSettingsPromise = getWebSettings().catch(() => defaultWebSettings);

  // Productos con fallback en cadena (DB viva → memoria → snapshot del build):
  // la home NUNCA renderiza sin productos, aunque la DB esté caída o el build
  // corra sin base. Ver src/lib/home-products.ts.
  const { data: homeData } = await getHomeProducts();

  // Formateo + dedup de variantes viven en src/lib/home-fallback.ts (fijados por check:home)
  const dbWebProducts = homeData.destacados;
  const carouselData = {
    destacados: formatProducts(homeData.destacados, resolveStorageUrl),
    sol: formatProducts(homeData.sol, resolveStorageUrl),
    receta: formatProducts(homeData.receta, resolveStorageUrl),
    nuevos: formatProducts(homeData.nuevos, resolveStorageUrl),
  };

  const catalogCount = homeData.count;

  // DÚO DESTACADO DE SOL: 2 piezas grandes bajo el carrusel. Se eligen de las
  // colecciones YA blindadas (misma tubería vivo→memoria→snapshot): primero los
  // destacados que sean de sol, y se completa con lo más nuevo de sol. Sin
  // queries nuevas — hereda la garantía de nunca quedar vacío.
  const isSol = (p: { category?: string | null }) => (p.category || "").toLowerCase().includes("sol");
  const featuredSol = carouselData.destacados.filter(isSol);
  const solShowcase = [
    ...featuredSol,
    ...carouselData.sol.filter((p) => !featuredSol.some((f) => f.id === p.id)),
  ].slice(0, 2);

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
      {/* DÚO DESTACADO DE SOL — 2 piezas grandes          */}
      {/* ═══════════════════════════════════════════════ */}
      {solShowcase.length === 2 && <HomeSolShowcase products={solShowcase} />}

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
