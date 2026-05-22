"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { FilmmakerReel } from "@/components/Storefront/FilmmakerReel";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";

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

export default function Home() {
  const containerRef = useRef(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1.05, 1]);

  const [dbProducts, setDbProducts] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/store/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDbProducts(data);
        }
      })
      .catch(console.error);
  }, []);

  // Hybrid Marquee Logic
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    let animationId: number;
    let isInteracting = false;

    const onInteract = () => { isInteracting = true; };
    const onStopInteract = () => { isInteracting = false; };

    container.addEventListener('touchstart', onInteract, { passive: true });
    container.addEventListener('touchend', onStopInteract, { passive: true });
    container.addEventListener('mousedown', onInteract, { passive: true });
    container.addEventListener('mouseup', onStopInteract, { passive: true });
    container.addEventListener('mouseleave', onStopInteract, { passive: true });

    let wheelTimeout: any;
    const onWheel = () => {
      isInteracting = true;
      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        isInteracting = false;
      }, 500);
    };
    container.addEventListener('wheel', onWheel, { passive: true });

    let scrollAccumulator = 0;
    const scroll = () => {
      if (!isInteracting) {
        scrollAccumulator += 1; // 1 pixel per frame (approx 60px/s)
        if (scrollAccumulator >= 1) {
          const shift = Math.floor(scrollAccumulator);
          container.scrollLeft += shift;
          scrollAccumulator -= shift;
          
          if (container.scrollLeft >= container.scrollWidth / 2) {
            container.scrollLeft -= container.scrollWidth / 2;
          }
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('touchstart', onInteract);
      container.removeEventListener('touchend', onStopInteract);
      container.removeEventListener('mousedown', onInteract);
      container.removeEventListener('mouseup', onStopInteract);
      container.removeEventListener('mouseleave', onStopInteract);
      container.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimeout);
    };
  }, [dbProducts]);

  // Filtramos solo los productos que tengan imagen y estén listos para la web (o al menos tengan imagen)
  const validWebProducts = dbProducts.filter(p => p.imagenesCatalogo && p.imagenesCatalogo.length > 0);

  // Si no hay productos reales con foto aún, usamos los de prueba para no dejar la web vacía
  const displayProducts = validWebProducts.length > 0 
    ? validWebProducts.map(p => ({
        id: p.id,
        name: `${p.brand} ${p.model}`,
        price: `$ ${p.price?.toLocaleString()}`,
        img: `/api/storage/view?key=${encodeURIComponent(p.imagenesCatalogo[0])}`,
        slug: p.id
      }))
    : PRODUCTS;

  return (
    <div ref={containerRef} className="bg-white text-black selection:bg-black selection:text-white overflow-x-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      
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
        {/* Título */}
        <div className="px-5 mb-2">
          <h2 className="text-[13px] font-bold tracking-normal uppercase">
            LATEST: ATELIER&apos;S NEW ARRIVAL
          </h2>
          <Link href="/tienda" className="text-[13px] font-medium underline underline-offset-4 decoration-1 hover:opacity-60 transition-opacity mt-1 inline-block">
            MORE
          </Link>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════ */}
      {/* PRODUCT GRID — Scroll horizontal como GM        */}
      {/* Fondo blanco, productos con MUCHO aire           */}
      {/* Nombre y precio debajo, tipografía pequeña       */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="w-full bg-white pb-20">
        <div 
          ref={carouselRef}
          className="flex w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...displayProducts, ...displayProducts, ...displayProducts, ...displayProducts].map((item, i) => (
            <Link 
              href={`/producto/${item.slug}`} 
              key={`${item.id}-${i}`} 
              className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-all duration-500 hover:scale-[1.03] hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
            >
              {/* Contenedor de imagen — fondo gris muy claro */}
              <div className="bg-[#f5f5f5] aspect-square overflow-hidden border-r border-[#e5e5e5] relative">
                {item.img ? (
                  <img 
                    src={item.img}
                    alt={item.name}
                    className="absolute inset-0 w-full h-full object-contain p-6 mix-blend-multiply group-hover:scale-110 transition-transform duration-500 ease-out"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center text-stone-400 text-[10px] font-black uppercase tracking-widest text-center">
                    Sin<br/>Imagen
                  </div>
                )}
              </div>
              
              {/* Nombre y precio — tipografía GM exacta */}
              <div className="px-3 pt-6 pb-4 border-r border-[#e5e5e5] h-full">
                <h3 className="text-[13px] font-medium">{item.name}</h3>
                <p className="text-[13px] text-[#999] mt-0.5">{item.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* CONFIGURADOR CTA — Nuestra diferencia vs GM     */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="w-full bg-[#f2f2f2] py-24 flex flex-col items-center justify-center text-center px-4 md:px-8 overflow-hidden">
        <motion.h2 
          className="text-2xl md:text-4xl font-serif uppercase tracking-tight mb-16"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          Armá tus anteojos graduados
        </motion.h2>

        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-12 md:gap-4 mb-16 relative">
          {/* Línea conectora (solo Desktop) */}
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-[1px] bg-black/10 z-0"></div>

          {/* Línea conectora (solo Mobile) */}
          <div className="md:hidden absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/10 -translate-x-1/2 z-0"></div>

          {[
            { num: 1, title: "Elegí tu armazón", desc: "Explorá la colección" },
            { num: 2, title: "Elegí tus cristales", desc: "A medida exacta" },
            { num: 3, title: "Enviá tu receta", desc: "Cargala en el checkout" },
            { num: 4, title: "Recibí tus lentes", desc: "Envío a tu hogar" }
          ].map((step, i) => (
            <motion.div 
              key={step.num}
              className="flex flex-col items-center relative z-10 bg-[#f2f2f2] px-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 + 0.2, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold mb-4 shadow-sm transition-all duration-500 ${step.num === 1 ? 'bg-black text-white' : 'bg-white border border-black/10 text-black'}`}>
                {step.num}
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-1.5">{step.title}</h3>
              <p className="text-[9px] text-[#999] uppercase tracking-[0.2em]">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Link 
            href="/arma-tus-lentes" 
            className="px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white bg-black border border-black rounded-full hover:bg-transparent hover:text-black transition-all duration-300 inline-block"
          >
            Comenzar ahora
          </Link>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* CINEMATIC MACRO FILM LOOP (HOME)                */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="w-full h-screen relative overflow-hidden bg-[#111]">
        <motion.div
          animate={{ scale: [1.0, 1.15, 1.0], x: ['0%', '-2%', '0%'], y: ['0%', '1%', '0%'] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
          className="absolute inset-0 w-[110%] h-[110%] -left-[5%] -top-[5%]"
        >
          <img src="/images/atelier-macro-film.png" alt="Atelier Macro Detail" className="w-full h-full object-cover opacity-90" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex items-end p-8 md:p-12">
          <p className="text-white/90 text-[10px] md:text-[12px] uppercase tracking-[0.4em] font-medium mix-blend-overlay">Atelier Óptica — Detalles</p>
        </div>
      </section>



      {/* ═══════════════════════════════════════════════ */}
      {/* GOOGLE REVIEWS (REAL TIME)                      */}
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
