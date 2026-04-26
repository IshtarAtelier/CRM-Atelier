"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const PRODUCTS = [
  { id: 1, name: "ATELIER 9030", subtitle: "Nylon · Cat Eye · Gold", price: "$ 55.000", img: "/images/products/atelier-9030-gold.jpg", slug: "atelier-carey-vintage" },
  { id: 2, name: "ROSÉ CAT EYE", subtitle: "Acetato · Cat Eye · Rosa", price: "$ 48.000", img: "/images/products/cateye-rose.jpg", slug: "atelier-carey-vintage" },
  { id: 3, name: "PANTOS BLUSH", subtitle: "Acetato · Redondo · Rosa", price: "$ 45.000", img: "/images/products/pantos-pink.jpg", slug: "atelier-carey-vintage" },
  { id: 4, name: "MISTRAL MANGLARES", subtitle: "Acetato · Cuadrado · Bordó", price: "$ 52.000", img: "/images/products/mistral-manglares.jpg", slug: "atelier-carey-vintage" },
  { id: 5, name: "CIMA DREAMY", subtitle: "Acetato · Hexagonal · Coral", price: "$ 58.000", img: "/images/products/cima-dreamy.jpg", slug: "atelier-carey-vintage" },
];

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1.1, 1]);

  return (
    <div ref={containerRef} className="bg-white text-black font-sans selection:bg-black selection:text-white overflow-x-hidden">
      
      {/* HEADER */}
      <header className="fixed top-0 w-full z-50 px-6 py-5 flex justify-between items-center mix-blend-difference text-white">
        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/tienda" className="hover:opacity-50 transition-opacity duration-300">Tienda</Link>
          <Link href="/blog" className="hover:opacity-50 transition-opacity duration-300">Editorial</Link>
        </div>
        
        <Link href="/" className="absolute left-1/2 -translate-x-1/2">
          <img 
            src="/images/logo-negro.png" 
            alt="Atelier Óptica" 
            className="h-8 w-auto invert"
          />
        </Link>

        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/admin" className="hover:opacity-50 transition-opacity duration-300">Mi Cuenta</Link>
          <button className="hover:opacity-50 transition-opacity duration-300">Carrito (0)</button>
        </div>
      </header>

      {/* ═══════════════════════════════════════ */}
      {/* HERO — MONA LISA FULL SCREEN            */}
      {/* Apaisado, zoom lento, impacto total     */}
      {/* ═══════════════════════════════════════ */}
      <section className="relative w-full h-screen overflow-hidden bg-black cursor-pointer group">
        <motion.div 
          className="absolute inset-0 w-full h-full"
          style={{ scale: heroScale }}
        >
          <img
            src="/images/editorial/monalisa.png"
            alt="Mona Lisa — Atelier Editorial"
            className="h-full w-full object-cover"
          />
        </motion.div>
        
        {/* Overlay gradiente sutil */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
        
        {/* Texto central moderno */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.p
            className="text-white/60 text-[10px] md:text-[12px] uppercase tracking-[0.6em] font-medium mb-5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2 }}
          >
            Colección 2026
          </motion.p>
          <motion.h1 
            className="text-white text-5xl md:text-8xl font-extralight tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1.5 }}
          >
            EL ARTE DE VER
          </motion.h1>
          <motion.div
            className="mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            <Link 
              href="#catalogo" 
              className="text-white/70 text-[10px] uppercase tracking-[0.3em] border-b border-white/30 pb-1 hover:text-white hover:border-white transition-all duration-300"
            >
              Descubrir
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════ */}
      {/* CATÁLOGO — 5 armazones reales           */}
      {/* ═══════════════════════════════════════ */}
      <section id="catalogo" className="w-full bg-white">
        <div className="px-8 pt-24 pb-6">
          <h3 className="text-[11px] font-medium tracking-[0.25em] uppercase text-black/30">
            Nuevos Ingresos
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 w-full border-t border-[#f0f0f0]">
          {PRODUCTS.map((item) => (
            <Link 
              href={`/producto/${item.slug}`} 
              key={item.id} 
              className="group relative block border-b border-r border-[#f0f0f0] overflow-hidden"
            >
              <div className="bg-[#f5f5f5] aspect-square flex items-center justify-center p-4 md:p-8 overflow-hidden">
                <motion.img 
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-sm"
                  whileHover={{ scale: 1.05 }}
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
      {/* CONFIGURADOR CTA                        */}
      {/* ═══════════════════════════════════════ */}
      <section className="w-full bg-[#fafafa] py-24 flex flex-col items-center justify-center text-center px-8">
        <motion.h2 
          className="text-2xl md:text-4xl font-extralight tracking-tight mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
        >
          Armá tus lentes a medida
        </motion.h2>
        <motion.p 
          className="text-[12px] text-black/40 max-w-md mb-10 leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          viewport={{ once: true }}
        >
          Elegí tu armazón, configurá tus cristales y recibí todo en tu casa. Envío gratis a todo el país.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          viewport={{ once: true }}
        >
          <Link 
            href="/producto/atelier-carey-vintage" 
            className="bg-black text-white text-[11px] uppercase tracking-[0.2em] font-medium px-10 py-4 hover:bg-black/80 transition-colors duration-300"
          >
            Configurar ahora
          </Link>
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
          <img src="/images/logo-blanco.png" alt="Atelier Óptica" className="h-20 md:h-32 w-auto" />
          <p className="text-[10px] uppercase tracking-widest text-gray-600 pb-2">© 2026 Atelier Óptica · Córdoba, Argentina</p>
        </div>
      </footer>
    </div>
  );
}
