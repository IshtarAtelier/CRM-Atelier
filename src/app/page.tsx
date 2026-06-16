import Link from "next/link";
import { Metadata } from "next";
import { Marquee } from "@/components/Storefront/Marquee";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { FilmmakerReel } from "@/components/Storefront/FilmmakerReel";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { HomeProductCarousel } from "@/components/Storefront/HomeProductCarousel";
import { HomeConfiguratorSection } from "@/components/Storefront/HomeConfiguratorSection";
import { HomeMacroFilm } from "@/components/Storefront/HomeMacroFilm";
import { HomeStorePreview } from "@/components/Storefront/HomeStorePreview";
import { HomeWhyChooseUs } from "@/components/Storefront/HomeWhyChooseUs";
import { HomeRecommendationQuiz } from "@/components/Storefront/HomeRecommendationQuiz";
import { ExitIntentPopup } from "@/components/Storefront/ExitIntentPopup";
import { prisma } from "@/lib/db";
import { resolveStorageUrl } from "@/lib/utils/storage";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Atelier Óptica | Anteojos, Cristales y Multifocales en Cuotas",
  description: "Atelier Óptica en Córdoba. Especialistas en anteojos de receta, lentes de sol, y multifocales Varilux. Envíos a todo el país y presupuestos rápidos por WhatsApp.",
  alternates: {
    canonical: 'https://www.atelieroptica.com.ar',
  },
  openGraph: {
    title: "Atelier Óptica | Anteojos, Cristales y Multifocales en Cuotas",
    description: "Especialistas en anteojos de receta, lentes de sol, y multifocales Varilux. Envíos a todo el país y presupuestos por WhatsApp.",
    url: 'https://www.atelieroptica.com.ar',
    type: 'website',
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
        include: {
          product: true
        },
        orderBy: { createdAt: 'desc' },
        take: 12 // Maximum of 12 featured products for best PageSpeed score and clean visual presentation
      });
      
      const [dbSol, dbReceta, dbNuevos, count] = await Promise.all([
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: 'Lentes de Sol' } },
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 12
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: 'Armazón de Receta' } },
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 12
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } },
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 12
        }),
        prisma.webProduct.count({
          where: { isActive: true, product: { publishToWeb: true, category: { not: 'Cristal' } } }
        })
      ]);

      solProducts = dbSol;
      recetaProducts = dbReceta;
      nuevosProducts = dbNuevos;
      totalCatalogCount = count;
  } catch (error) {
    console.error("Prerendering warning: Database not reachable at build time. Using fallbacks.", error);
  }

  // Formateamos los productos para el carrusel
  const formatProducts = (list: any[]) => list.length > 0 
    ? list.map(wp => ({
        id: wp.product.id,
        name: wp.name,
        price: wp.product.price ? `6 cuotas de $${Math.round(wp.product.price / 6).toLocaleString("es-AR")}` : "",
        img: wp.imageUrl 
          ? resolveStorageUrl(wp.imageUrl)
          : (wp.images.length > 0 
              ? resolveStorageUrl(wp.images[0])
              : (wp.product.imagenesCatalogo.length > 0 ? resolveStorageUrl(wp.product.imagenesCatalogo[0]) : '/images/og-image.jpg')),
        slug: wp.slug,
        stock: wp.product.stock,
        brand: wp.product.brand,
        model: wp.product.model,
        secondImg: wp.images.length > 1 
          ? resolveStorageUrl(wp.images[1])
          : (wp.product.imagenesCatalogo.length > 1 ? resolveStorageUrl(wp.product.imagenesCatalogo[1]) : null),
        category: wp.product.category
      }))
    : [];

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
    "name": "Atelier Óptica",
    "url": "https://www.atelieroptica.com.ar",
    "logo": "https://www.atelieroptica.com.ar/assets/logo-pwa-512.png",
    "sameAs": [
      "https://www.instagram.com/atelier.optica/",
      "https://maps.app.goo.gl/atelieroptica"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+54 9 354 121 5971",
      "contactType": "customer service",
      "availableLanguage": "Spanish"
    }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "Optician",
    "name": "Atelier Óptica",
    "image": "https://www.atelieroptica.com.ar/assets/logo-pwa-512.png",
    "url": "https://www.atelieroptica.com.ar",
    "telephone": "+54 9 354 121 5971",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "José Luis de Tejeda 4380",
      "addressLocality": "Cerro de las Rosas, Córdoba",
      "addressRegion": "Córdoba",
      "postalCode": "5009",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -31.3831,
      "longitude": -64.24005
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "09:30",
        "closes": "13:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "16:30",
        "closes": "20:30"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:30",
        "closes": "13:00"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5.0",
      "reviewCount": "89"
    },
    "sameAs": [
      "https://www.instagram.com/atelier.optica/",
      "https://maps.app.goo.gl/atelieroptica"
    ]
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Atelier Óptica",
    "url": "https://www.atelieroptica.com.ar",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://www.atelieroptica.com.ar/tienda?q={search_term}",
      "query-input": "required name=search_term"
    }
  };

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": dbWebProducts.map((wp, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://www.atelieroptica.com.ar/producto/${wp.slug}`,
      "name": wp.name,
      "image": wp.imageUrl 
        ? resolveStorageUrl(wp.imageUrl) 
        : (wp.images?.length > 0 ? resolveStorageUrl(wp.images[0]) : "https://www.atelieroptica.com.ar/assets/logo-pwa-512.png")
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
      <StorefrontNavbar theme="dark" />

      {/* ═══════════════════════════════════════════════ */}
      {/* FILMMAKER REEL — Hero principal cinematográfico   */}
      {/* ═══════════════════════════════════════════════ */}
      <FilmmakerReel />

      <h1 className="sr-only">Atelier Óptica Córdoba — Anteojos de Receta, Lentes de Sol y Multifocales</h1>

      {/* ═══════════════════════════════════════════════ */}
      {/* GOOGLE REVIEWS (REAL TIME - Server Component)   */}
      {/* ═══════════════════════════════════════════════ */}
      <GoogleReviews />

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
            LATEST: ATELIER&apos;S NEW ARRIVAL
          </h2>
          <Link href="/tienda" className="text-[13px] font-medium underline underline-offset-4 decoration-1 hover:opacity-60 transition-opacity mt-1 inline-block">
            MORE
          </Link>
        </div>
      </section>

      {/* PRODUCT GRID — Scroll horizontal infinito en Cliente */}
      <HomeProductCarousel collections={carouselData} totalCount={catalogCount} />

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
      <FloatingWhatsApp />
      <ExitIntentPopup />
    </div>
  );
}
