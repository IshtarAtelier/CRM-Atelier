"use client";

import { motion } from "framer-motion";

export function HomeMacroFilm() {
  return (
    <section className="w-full h-screen relative overflow-hidden bg-[#111]">
      <motion.div
        animate={{ scale: [1.0, 1.15, 1.0], x: ['0%', '-2%', '0%'], y: ['0%', '1%', '0%'] }}
        transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        className="absolute inset-0 w-[110%] h-[110%] -left-[5%] -top-[5%]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/atelier-macro-film.png" alt="Atelier Macro Detail" className="w-full h-full object-cover opacity-90" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent flex items-end p-8 md:p-12">
        <p className="text-white/90 text-[10px] md:text-[12px] uppercase tracking-[0.4em] font-medium mix-blend-overlay">Atelier Óptica — Detalles</p>
      </div>
    </section>
  );
}
