"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// ==========================================
// ATELIER ÓPTICA — GENTLE MONSTER STYLE
// Blanco puro. Anteojos gigantes. Sin ruido.
// ==========================================

const PRODUCTS = [
  { id: 1, name: "ATELIER 9030", subtitle: "Nylon · Cat Eye · Gold", price: "$ 55.000", img: "/images/products/atelier-9030-gold.jpg", slug: "atelier-9030" },
  { id: 2, name: "ROSÉ CAT EYE", subtitle: "Acetato · Cat Eye · Rosa", price: "$ 48.000", img: "/images/products/cateye-rose.jpg", slug: "rose-cateye" },
  { id: 3, name: "PANTOS BLUSH", subtitle: "Acetato · Redondo · Rosa", price: "$ 45.000", img: "/images/products/pantos-pink.jpg", slug: "pantos-blush" },
  { id: 4, name: "MISTRAL MANGLARES", subtitle: "Acetato · Cuadrado · Bordó", price: "$ 52.000", img: "/images/products/mistral-manglares.jpg", slug: "mistral-manglares" },
  { id: 5, name: "CIMA DREAMY", subtitle: "Acetato · Hexagonal · Coral", price: "$ 58.000", img: "/images/products/cima-dreamy.jpg", slug: "cima-dreamy" },
];

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], ["0%", "20%"]);

  return (
    <div ref={containerRef} className="bg-white text-black font-sans selection:bg-black selection:text-white overflow-x-hidden">
      
      {/* ═══════════════════════════════════════ */}
      {/* HEADER                                  */}
      {/* ═══════════════════════════════════════ */}
      <header className="fixed top-0 w-full z-50 px-6 py-5 flex justify-between items-center mix-blend-difference text-white">
        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/tienda" className="hover:opacity-50 transition-opacity duration-300">Tienda</Link>
          <Link href="/blog" className="hover:opacity-50 transition-opacity duration-300">Editorial</Link>
        </div>
        
        <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-[15px] font-bold tracking-[0.15em]">
          ATELIER
        </Link>

        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/admin" className="hover:opacity-50 transition-opacity duration-300">Mi Cuenta</Link>
          <button className="hover:opacity-50 transition-opacity duration-300">Carrito (0)</button>
        </div>
      </header>

      {/* ═══════════════════════════════════════ */}
      {/* HERO — Blanco puro, primer armazón ENORME */}
      {/* ═══════════════════════════════════════ */}
      <section className="relative w-full h-screen flex items-center justify-center bg-white overflow-hidden">
        <motion.div 
          style={{ y: heroY }}
          className="relative w-[85vw] max-w-[950px] flex items-center justify-center"
        >
          <motion.img 
            src="/images/products/atelier-9030-gold.jpg"
            alt="Atelier 9030 — Colección 2026"
            className="w-full object-contain drop-shadow-[0_25px_80px_rgba(0,0,0,0.08)]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>
        
        <motion.div 
          className="absolute bottom-14 left-0 w-full text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <p className="text-[11px] font-medium tracking-[0.35em] uppercase text-black/30">
            Colección Óptica 2026
          </p>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════ */}
      {/* EDITORIAL — Mona Lisa con anteojos      */}
      {/* Encuadre APAISADO y Zoom Moderno        */}
      {/* ═══════════════════════════════════════ */}
      <section className="relative w-full h-[60vh] md:h-[75vh] bg-white overflow-hidden flex items-center justify-center">
        <div className="relative w-full h-full overflow-hidden">
          <motion.img
            src="/images/editorial/monalisa.png"
            alt="Mona Lisa — Atelier Editorial"
            className="h-full w-full object-cover"
            style={{ transformOrigin: "center 30%" }}
            initial={{ scale: 1.15 }}
            whileInView={{ scale: 1 }}
            transition={{ duration: 10, ease: "linear" }}
            viewport={{ once: true }}
          />
          {/* Capa de limpieza moderna (overlay sutil) */}
          <div className="absolute inset-0 bg-black/5" />
          
          {/* Texto Moderno y Limpio centrado */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <motion.p
              className="text-white text-[10px] md:text-[12px] uppercase tracking-[0.6em] font-bold mb-4 drop-shadow-lg"
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.6em" }}
              transition={{ delay: 0.5, duration: 1.5 }}
              viewport={{ once: true }}
            >
              Editorial
            </motion.p>
            <motion.h2 
              className="text-white text-4xl md:text-7xl font-light tracking-tighter drop-shadow-2xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 1.2 }}
              viewport={{ once: true }}
            >
              EL ARTE DE VER
            </motion.h2>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════ */}
      {/* CATÁLOGO — Tus 5 armazones reales       */}
      {/* Fondo blanco puro, fotos flotantes      */}
      {/* ═══════════════════════════════════════ */}
      <section className="w-full bg-white">
        <div className="px-8 pt-24 pb-6 text-center md:text-left">
          <h3 className="text-[11px] font-medium tracking-[0.25em] uppercase text-black/30">
            Nuevos Ingresos
          </h3>
        </div>

        {/* Grilla de productos — Blanca, limpia, borde fino */}
        <div className="grid grid-cols-2 lg:grid-cols-5 w-full border-t border-[#f0f0f0]">
          {PRODUCTS.map((item) => (
            <Link 
              href={`/producto/${item.slug}`} 
              key={item.id} 
              className="group relative block border-b border-r border-[#f0f0f0] overflow-hidden"
            >
              <div className="bg-white aspect-square flex items-center justify-center p-6 md:p-10">
                <motion.img 
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              
              <div className="px-4 py-4">
                <h4 className="text-[10px] font-bold tracking-[0.1em] uppercase">{item.name}</h4>
                <p className="text-[9px] text-black/30 mt-0.5 tracking-wide">{item.subtitle}</p>
                <p className="text-[11px] text-black/60 mt-2 font-medium">{item.price}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center py-16">
          <Link 
            href="/tienda" 
            className="text-[11px] font-medium uppercase tracking-[0.2em] border-b border-black/15 pb-1 hover:border-black transition-colors duration-300"
          >
            Ver toda la colección
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════ */}
      {/* BANNER — Segundo anteojo protagonista   */}
      {/* ═══════════════════════════════════════ */}
      <section className="w-full h-[80vh] bg-white flex items-center justify-center relative overflow-hidden">
        <motion.img
          src="/images/products/cima-dreamy.jpg"
          alt="CIMA Dreamy — Colección Coral"
          className="w-[65vw] max-w-[750px] object-contain drop-shadow-[0_30px_80px_rgba(0,0,0,0.06)]"
          initial={{ x: 80, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
        />
        <motion.div 
          className="absolute bottom-12 right-8 text-right"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/25 font-medium">CIMA Dreamy</p>
          <p className="text-[10px] uppercase tracking-[0.15em] text-black/15 mt-1">Hexagonal · Coral</p>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════ */}
      {/* FOOTER                                  */}
      {/* ═══════════════════════════════════════ */}
      <footer className="w-full bg-black text-white px-8 py-20 flex flex-col justify-between min-h-[50vh]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-[11px] uppercase tracking-wider font-medium">
          <div className="flex flex-col gap-4">
            <Link href="/tienda" className="hover:text-gray-400 transition-colors">Tienda</Link>
            <Link href="/blog" className="hover:text-gray-400 transition-colors">Editorial</Link>
            <Link href="#" className="hover:text-gray-400 transition-colors">Nosotros</Link>
          </div>
          <div className="flex flex-col gap-4">
            <Link href="#" className="hover:text-gray-400 transition-colors">Envíos</Link>
            <Link href="#" className="hover:text-gray-400 transition-colors">Cambios</Link>
            <Link href="#" className="hover:text-gray-400 transition-colors">Contacto</Link>
          </div>
          <div className="flex flex-col gap-4">
            <Link href="#" className="hover:text-gray-400 transition-colors">Instagram</Link>
            <Link href="#" className="hover:text-gray-400 transition-colors">WhatsApp</Link>
          </div>
        </div>
        
        <div className="w-full mt-auto border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-end gap-8">
          <h1 className="text-6xl md:text-[10rem] font-bold tracking-tighter leading-none select-none">ATELIER</h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-600 pb-2">© 2026 Atelier Óptica · Córdoba, Argentina</p>
        </div>
      </footer>
    </div>
  );
}
