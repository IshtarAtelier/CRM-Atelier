"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

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
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1.05, 1]);

  return (
    <div ref={containerRef} className="bg-white text-black selection:bg-black selection:text-white overflow-x-hidden" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      
      {/* ═══════════════════════════════════════════════ */}
      {/* NAV — Replica exacta de Gentle Monster          */}
      {/* Shop / Explore | ATELIER (centro) | 🔍 👤 🛒    */}
      {/* ═══════════════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50 px-5 py-4 flex justify-between items-center bg-transparent">
        {/* Izquierda: Links de navegación */}
        <nav className="flex gap-5">
          <Link href="/tienda" className="text-[13px] font-medium text-white hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
            Shop
          </Link>
          <Link href="/blog" className="text-[13px] font-medium text-white hover:opacity-60 transition-opacity" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
            Explore
          </Link>
        </nav>
        
        {/* Centro: Texto logo */}
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold tracking-[0.15em] text-white drop-shadow-md" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
          ATELIER ÓPTICA
        </Link>

        {/* Derecha: Iconos */}
        <div className="flex items-center gap-5">
          <button className="text-white hover:opacity-60 transition-opacity" aria-label="Buscar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <Link href="/admin" className="text-white hover:opacity-60 transition-opacity" aria-label="Mi cuenta">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.12a9 9 0 0115 0"/></svg>
          </Link>
          <button className="text-white hover:opacity-60 transition-opacity relative" aria-label="Carrito">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"/></svg>
            <span className="absolute -top-1 -right-2 text-[9px] font-bold text-white bg-black/50 rounded-full w-4 h-4 flex items-center justify-center backdrop-blur-sm">0</span>
          </button>
        </div>
      </header>

      {/* CSS Animations para el hero */}
      <style jsx global>{`
        @keyframes heroZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.2); }
        }
        @keyframes fadeInText {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 0.85; transform: scale(1); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════ */}
      {/* HERO — Zoom cinemático hacia los anteojos        */}
      {/* ═══════════════════════════════════════════════ */}
      <section className="relative w-full h-[80vh] overflow-hidden bg-black">
        {/* Imagen con zoom CSS puro — 15 segundos hacia los ojos */}
        <div className="absolute inset-0" style={{ transformOrigin: "center 40%", animation: "heroZoom 15s ease-out forwards" }}>
          <img
            src="/images/editorial/monalisa.png"
            alt="Atelier — Tu visión, nuestra obra maestra"
            className="h-full w-full object-cover"
          />
        </div>
        
        {/* Texto transparente centrado con mix-blend-overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <h1 
            className="text-white text-4xl md:text-7xl lg:text-8xl font-extralight tracking-tight text-center mix-blend-overlay select-none px-4"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif", animation: "fadeInText 2.5s ease-out 1s forwards", opacity: 0 }}
          >
            Tu visión, nuestra<br />obra maestra
          </h1>
        </div>

        {/* Gradiente sutil en la base */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Indicador de slides (barras como GM) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <div className="w-16 h-[2px] bg-white" />
          <div className="w-16 h-[2px] bg-white/30" />
          <div className="w-16 h-[2px] bg-white/30" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* LATEST — Título + Catálogo horizontal scroll    */}
      {/* GM usa "LATEST: GENTLE MONSTER'S NEW ARRIVAL"   */}
      {/* Nosotros: "LATEST: ATELIER'S NEW ARRIVAL"       */}
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
      <section className="w-full bg-white pb-20 overflow-hidden">
        {/* Contenedor infinito: renderizamos 4 veces la lista para que -50% sea un loop perfecto */}
        <div 
          className="flex w-max"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {[...PRODUCTS, ...PRODUCTS, ...PRODUCTS, ...PRODUCTS].map((item, i) => (
            <Link 
              href={`/producto/${item.slug}`} 
              key={`${item.id}-${i}`} 
              className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block"
            >
              {/* Contenedor de imagen — fondo gris muy claro, mucho padding */}
              <div className="bg-[#f2f2f2] aspect-square flex items-center justify-center p-10 md:p-16 overflow-hidden border-r border-[#e5e5e5]">
                <motion.img 
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-contain mix-blend-multiply"
                  whileHover={{ scale: 1.06 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
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
      <section className="w-full bg-[#f2f2f2] py-24 flex flex-col items-center justify-center text-center px-8">
        <motion.h2 
          className="text-xl md:text-3xl font-normal tracking-tight mb-3"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          Armá tus lentes a medida
        </motion.h2>
        <motion.p 
          className="text-[13px] text-[#999] max-w-md mb-8 leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
        >
          Elegí tu armazón, configurá tus cristales y recibí todo en tu casa. Envío gratis a todo el país.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
        >
          <Link 
            href="/producto/atelier-carey-vintage" 
            className="px-8 py-3 text-[12px] font-medium tracking-wide text-black border border-black/80 rounded-full hover:bg-black hover:text-white transition-all duration-300"
          >
            Configurar ahora
          </Link>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════ */}
      {/* FOOTER — Replica exacta de Gentle Monster       */}
      {/* Solo links de texto, redes sociales, copyright  */}
      {/* ═══════════════════════════════════════════════ */}
      <footer className="w-full bg-white border-t border-[#e5e5e5]">
        {/* Links principales */}
        <div className="px-5 py-10 flex flex-col gap-3">
          <Link href="#" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Contact Us</Link>
          <Link href="#" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Customer Service</Link>
          <Link href="/admin" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Store Locator</Link>
          <Link href="/blog" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Editorial</Link>
        </div>

        {/* Separador */}
        <div className="border-t border-[#e5e5e5]" />

        {/* Redes sociales */}
        <div className="px-5 py-8">
          <p className="text-[13px] text-[#999] mb-4">
            Follow our official social accounts for a variety of content.
          </p>
          <div className="flex flex-wrap gap-5">
            <Link href="#" className="text-[13px] font-medium hover:opacity-60 transition-opacity">Instagram</Link>
            <Link href="#" className="text-[13px] font-medium hover:opacity-60 transition-opacity">TikTok</Link>
            <Link href="#" className="text-[13px] font-medium hover:opacity-60 transition-opacity">WhatsApp</Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-[#e5e5e5]" />
        <div className="px-5 py-6">
          <p className="text-[13px] text-[#999]">© 2026 ATELIER ÓPTICA</p>
        </div>
      </footer>
    </div>
  );
}
