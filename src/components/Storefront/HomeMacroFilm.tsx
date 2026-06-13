"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef, useEffect, useState } from "react";

export function HomeMacroFilm() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Scroll-linked aperture open and close reveal effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // 3D rotation angles for left and right panels
  const leftRotate = useTransform(
    scrollYProgress,
    [0.4, 0.6, 0.8, 0.95],
    [0, -82, -82, 0]
  );

  const rightRotate = useTransform(
    scrollYProgress,
    [0.4, 0.6, 0.8, 0.95],
    [0, 82, 82, 0]
  );

  // X translation to shift panels apart, creating a wider viewing gap in the center
  const leftX = useTransform(
    scrollYProgress,
    [0.4, 0.6, 0.8, 0.95],
    ["0%", "-25%", "-25%", "0%"]
  );

  const rightX = useTransform(
    scrollYProgress,
    [0.4, 0.6, 0.8, 0.95],
    ["0%", "25%", "25%", "0%"]
  );

  // Opacity and scale for the text inside the core
  const textOpacity = useTransform(
    scrollYProgress,
    [0.45, 0.6, 0.8, 0.9],
    [0, 1, 1, 0]
  );

  const textScale = useTransform(
    scrollYProgress,
    [0.45, 0.6, 0.8, 0.9],
    [0.9, 1, 1, 0.9]
  );

  return (
    <section
      ref={containerRef}
      className="w-full h-[90vh] md:h-screen relative overflow-hidden bg-[#050505] flex items-center justify-center select-none"
      style={{ perspective: "1500px" }}
    >
      {/* ─── BACKGROUND REVEALED CORES (Brand Text) ─── */}
      <div 
        className="absolute inset-0 w-full h-full z-0 flex items-center justify-center pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, #121212 0%, #050505 100%)"
        }}
      >
        {/* Elegant typography overlay */}
        <motion.div
          style={{ opacity: textOpacity, scale: textScale }}
          className="absolute z-10 flex flex-col items-center justify-center text-center px-6 max-w-2xl pointer-events-none"
        >
          <p className="text-white/40 text-[10px] md:text-[11px] uppercase tracking-[0.55em] font-semibold mb-4">
            Atelier Óptica — Detalles
          </p>
          <h2
            className="text-white text-4xl md:text-6xl font-light tracking-tight leading-none mb-6"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            La mirada en acción
          </h2>
          <p className="text-white/30 text-[10px] md:text-xs font-light tracking-[0.2em] max-w-md uppercase leading-relaxed">
            Curaduría de diseño y precisión en cada detalle. Experimentá la fusión entre arte y tecnología.
          </p>
        </motion.div>
      </div>

      {/* ─── 3D SPLIT PANEL SHUTTER (Left Door) ─── */}
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
          transformOrigin: "left center",
          rotateY: leftRotate,
          x: leftX,
          z: 2
        }}
        className="border-r border-black/40 shadow-[10px_0_30px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute inset-0 w-[200%] h-full left-0">
          <Image
            src="/images/atelier-macro-film.webp"
            alt="Atelier Macro Detail Left"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        {/* Soft shadow vignette to emphasize depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />
      </motion.div>

      {/* ─── 3D SPLIT PANEL SHUTTER (Right Door) ─── */}
      <motion.div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          overflow: "hidden",
          transformOrigin: "right center",
          rotateY: rightRotate,
          x: rightX,
          z: 2
        }}
        className="border-l border-black/40 shadow-[-10px_0_30px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute inset-0 w-[200%] h-full left-[-100%]">
          <Image
            src="/images/atelier-macro-film.webp"
            alt="Atelier Macro Detail Right"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        {/* Soft shadow vignette to emphasize depth */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />
      </motion.div>
    </section>
  );
}
