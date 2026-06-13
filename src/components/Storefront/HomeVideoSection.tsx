"use client";

import { motion } from "framer-motion";

interface HomeVideoSectionProps {
  youtubeVideoId?: string;
  instagramUrl?: string;
}

export function HomeVideoSection({ youtubeVideoId = "dQw4w9WgXcQ", instagramUrl }: HomeVideoSectionProps) {
  return (
    <section className="relative w-full h-[80vh] md:h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Fallback de carga o fondo negro */}
      <div className="absolute inset-0 bg-[#0a0a0a]" />

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        viewport={{ once: true }}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        {/* Usamos iframe de YouTube optimizado para que parezca un video de fondo.
            Si el usuario pasa una URL de Instagram después, se puede adaptar esta parte. */}
        <iframe
          src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&controls=0&modestbranding=1&rel=0&showinfo=0`}
          title="Atelier Video Reel"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          className="absolute w-[150vw] h-[150vh] -left-[25vw] -top-[25vh] object-cover opacity-80"
          style={{ border: "none" }}
        />
      </motion.div>

      {/* Overlay Oscuro / Viñeta para dar efecto cinemático y leer texto si se necesita */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 flex flex-col justify-end p-8 md:p-12 z-10 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          viewport={{ once: true }}
        >
          <p className="text-white/80 text-[10px] md:text-[12px] uppercase tracking-[0.4em] font-medium mix-blend-overlay mb-2">
            Atelier Óptica — Movimiento
          </p>
          <h2 
            className="text-white text-3xl md:text-5xl font-bold tracking-tight leading-none"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            La mirada en acción
          </h2>
        </motion.div>
      </div>

      {/* Instrucciones para el desarrollador/usuario sobre dónde cambiar el ID */}
      {/* TODO: Cambiar 'youtubeVideoId' en page.tsx con el ID real del video de Atelier */}
    </section>
  );
}
