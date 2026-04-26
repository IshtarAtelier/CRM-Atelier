"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

// Estructura de campaña "Gentle Monster" (Imágenes masivas, cero márgenes)
export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  
  // Parallax para el hero
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <div ref={containerRef} className="bg-white text-black font-sans selection:bg-black selection:text-white">
      
      {/* HEADER ULTRA MINIMALISTA FLOTANTE */}
      <header className="fixed top-0 w-full z-50 px-6 py-5 flex justify-between items-center mix-blend-difference text-white">
        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/tienda" className="hover:opacity-60 transition-opacity">Shop</Link>
          <Link href="/blog" className="hover:opacity-60 transition-opacity">Editorial</Link>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 text-[14px] font-bold tracking-[0.1em]">
          ATELIER
        </div>

        <div className="flex gap-6 text-[11px] font-medium tracking-[0.05em] uppercase">
          <Link href="/admin" className="hover:opacity-60 transition-opacity">Account</Link>
          <button className="hover:opacity-60 transition-opacity">Cart (0)</button>
        </div>
      </header>

      {/* SECTION 1: HERO CAMPAIGN (FULL BLEED) */}
      <section className="relative w-full h-screen overflow-hidden bg-black cursor-pointer group">
        <motion.div style={{ y }} className="absolute inset-0 w-full h-[120%]">
          <img 
            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=2000" 
            alt="Atelier Campaign"
            className="w-full h-full object-cover opacity-90 transition-transform duration-[2s] group-hover:scale-105"
          />
        </motion.div>
        
        {/* Call to action sutil en el centro */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <h2 className="text-white text-5xl md:text-8xl font-normal tracking-tight mix-blend-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-700">
            2026 COLLECTION
          </h2>
        </div>
      </section>

      {/* SECTION 2: SPLIT SCREEN CATEGORIES */}
      <section className="w-full h-screen flex flex-col md:flex-row">
        {/* Lado Izquierdo: Optical */}
        <Link href="/producto/atelier-carey-vintage" className="relative w-full md:w-1/2 h-1/2 md:h-full overflow-hidden group block cursor-pointer">
          <div className="absolute inset-0">
            <img 
              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=1200" 
              alt="Optical"
              className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-105"
            />
          </div>
          <div className="absolute bottom-8 left-8">
            <h3 className="text-white text-[13px] font-medium tracking-[0.05em] uppercase">Optical</h3>
          </div>
        </Link>

        {/* Lado Derecho: Sunglasses */}
        <Link href="/producto/atelier-carey-vintage" className="relative w-full md:w-1/2 h-1/2 md:h-full overflow-hidden group block cursor-pointer bg-[#f4f4f4]">
          <div className="absolute inset-0 p-20 flex items-center justify-center">
            {/* Acá simulamos un "Bodegón" gigante y nítido de Gentle Monster */}
            <img 
              src="https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=1000&bg=transparent" 
              alt="Sun"
              className="w-full max-w-md object-contain drop-shadow-2xl transition-transform duration-[1.5s] group-hover:scale-110"
            />
          </div>
          <div className="absolute bottom-8 left-8">
            <h3 className="text-black text-[13px] font-medium tracking-[0.05em] uppercase">Sunglasses</h3>
          </div>
        </Link>
      </section>

      {/* SECTION 3: MASSIVE GRID (Productos puros en grises limpios) */}
      <section className="w-full bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
          {[
            { id: 1, name: "CIMA 01", price: "USD 280.00", img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800&bg=transparent" },
            { id: 2, name: "MISTRAL X", price: "USD 310.00", img: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&q=80&w=800&bg=transparent" },
            { id: 3, name: "NYLON 90", price: "USD 260.00", img: "https://images.unsplash.com/photo-1582142407894-ec85a1260a46?auto=format&fit=crop&q=80&w=800&bg=transparent" },
            { id: 4, name: "ATELIER B", price: "USD 350.00", img: "https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&q=80&w=800&bg=transparent" },
          ].map((item) => (
            <Link href="/producto/atelier-carey-vintage" key={item.id} className="group relative border-r border-b border-[#eee] block overflow-hidden">
              <div className="bg-[#f8f8f8] aspect-[3/4] flex items-center justify-center p-12 transition-colors duration-500 group-hover:bg-[#f0f0f0]">
                <img 
                  src={item.img} 
                  alt={item.name}
                  className="w-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="absolute top-4 left-4 right-4 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <p className="text-[10px] font-bold uppercase">{item.name}</p>
                 <p className="text-[10px] font-normal">{item.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FOOTER GIGANTE */}
      <footer className="w-full bg-black text-white px-8 py-24 flex flex-col justify-between h-[60vh]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-[11px] uppercase tracking-wider font-medium">
          <div className="flex flex-col gap-4">
            <Link href="#" className="hover:text-gray-400">Stores</Link>
            <Link href="#" className="hover:text-gray-400">Campaigns</Link>
            <Link href="#" className="hover:text-gray-400">Stories</Link>
          </div>
          <div className="flex flex-col gap-4">
            <Link href="#" className="hover:text-gray-400">Shipping</Link>
            <Link href="#" className="hover:text-gray-400">Returns</Link>
            <Link href="#" className="hover:text-gray-400">Repairs</Link>
          </div>
          <div className="flex flex-col gap-4">
            <Link href="#" className="hover:text-gray-400">Instagram</Link>
            <Link href="#" className="hover:text-gray-400">TikTok</Link>
          </div>
        </div>
        
        <div className="w-full mt-auto border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-end gap-8">
          <h1 className="text-6xl md:text-[10rem] font-bold tracking-tighter leading-none">ATELIER</h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 pb-2">© 2026 Atelier Optica. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
