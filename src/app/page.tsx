import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { FilmmakerReel } from "@/components/Storefront/FilmmakerReel";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { HomeProductCarousel } from "@/components/Storefront/HomeProductCarousel";
import { HomeConfiguratorSection } from "@/components/Storefront/HomeConfiguratorSection";
import { HomeMacroFilm } from "@/components/Storefront/HomeMacroFilm";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// ==========================================
// ATELIER ÓPTICA — GENTLE MONSTER REPLICA
// Estructura exacta: Hero cinematográfico
// + Horizontal product scroll + Footer simple
// ==========================================

const PRODUCTS = [
  { id: 1, name: "Atelier 9030(GLD)", price: "$ 55.000", img: "/images/products/atelier-9030-gold.png", slug: "atelier-carey-vintage" },
  { id: 2, name: "Rosé Cat Eye(PNK)", price: "$ 48.000", img: "/images/products/cateye-rose.png", slug: "atelier-carey-vintage" },
  { id: 3, name: "Pantos Blush(RSE)", price: "$ 45.000", img: "/images/products/pantos-pink.png", slug: "atelier-carey-vintage" },
  { id: 4, name: "Mistral Manglares(BRD)", price: "$ 52.000", img: "/images/products/mistral-manglares.png", slug: "atelier-carey-vintage" },
  { id: 5, name: "Cima Dreamy(CRL)", price: "$ 58.000", img: "/images/products/cima-dreamy.png", slug: "atelier-carey-vintage" },
];

export default async function Home() {
  // 1. Server-Side Data Fetching (Reemplaza el antiguo useEffect)
  const dbProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true,
      category: { not: 'Cristal' } // No mostramos cristales sueltos en el catálogo principal
    },
    select: {
      id: true,
      name: true,
      brand: true,
      model: true,
      price: true,
      imagenesCatalogo: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 40
  });

  // Filtramos solo los productos que tengan imagen
  const validWebProducts = dbProducts.filter(p => p.imagenesCatalogo && p.imagenesCatalogo.length > 0);

  // Formateamos los productos para el carrusel
  const displayProducts = validWebProducts.length > 0 
    ? validWebProducts.map(p => ({
        id: p.id,
        name: `${p.brand} ${p.model}`,
        price: `$ ${p.price?.toLocaleString()}`,
        img: `/api/storage/view?key=${encodeURIComponent(p.imagenesCatalogo[0])}`,
        slug: p.id.toString()
      }))
    : PRODUCTS;

  return (
    <div className="bg-white text-black selection:bg-black selection:text-white overflow-x-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      
      {/* ═══════════════════════════════════════════════ */}
      {/* NAV — Replica exacta de Gentle Monster          */}
      {/* ═══════════════════════════════════════════════ */}
      <StorefrontNavbar theme="dark" />

      {/* ═══════════════════════════════════════════════ */}
      {/* FILMMAKER REEL — Hero principal cinematográfico   */}
      {/* ═══════════════════════════════════════════════ */}
      <FilmmakerReel />

      {/* ═══════════════════════════════════════════════ */}
      {/* MARQUEE — Texto deslizante entre secciones      */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="w-full bg-black border-y border-white/10 py-3 overflow-hidden">
        <div
          className="flex w-max gap-0"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[...Array(4)].map((_, i) => (
            <span key={i} className="flex items-center gap-8 pr-8 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60 whitespace-nowrap">
              <span>Acetato Italiano</span>
              <span className="text-white/20">·</span>
              <span>Cristales Premium</span>
              <span className="text-white/20">·</span>
              <span>Envío a Todo el País</span>
              <span className="text-white/20">·</span>
              <span>Garantía de Adaptación</span>
              <span className="text-white/20">·</span>
              <span>6 Cuotas Sin Interés</span>
              <span className="text-white/20">·</span>
              <span>Armazones de Diseño</span>
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
      <HomeProductCarousel products={displayProducts} />

      {/* ═══════════════════════════════════════════════ */}
      {/* CONFIGURADOR CTA — Nuestra diferencia vs GM     */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeConfiguratorSection />

      {/* ═══════════════════════════════════════════════ */}
      {/* CINEMATIC MACRO FILM LOOP (HOME)                */}
      {/* ═══════════════════════════════════════════════ */}
      <HomeMacroFilm />

      {/* ═══════════════════════════════════════════════ */}
      {/* GOOGLE REVIEWS (REAL TIME - Server Component)   */}
      {/* ═══════════════════════════════════════════════ */}
      <GoogleReviews />

      {/* ═══════════════════════════════════════════════ */}
      {/* FOOTER Y WIDGETS                               */}
      {/* ═══════════════════════════════════════════════ */}
      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
