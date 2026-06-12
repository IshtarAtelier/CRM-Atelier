"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { WHATSAPP_PHONE } from "@/lib/constants";

export function HomeConfiguratorSection() {
  return (
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
        className="flex flex-col items-center gap-4"
      >
        <Link 
          href="/arma-tus-lentes" 
          className="px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white bg-black border border-black rounded-full hover:bg-transparent hover:text-black transition-all duration-300 inline-block shadow-lg"
        >
          Cotizá tus lentes en 60 segundos
        </Link>
        <a
          href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent("Hola, me gustaría recibir asesoramiento para elegir mis lentes graduados.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-bold uppercase tracking-[0.15em] text-stone-500 hover:text-black transition-colors underline underline-offset-4"
        >
          ¿No sabés qué lentes elegir? Te ayudamos
        </a>
      </motion.div>
    </section>
  );
}
