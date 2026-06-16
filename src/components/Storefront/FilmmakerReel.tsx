"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";

const FRAMES = [
  {
    id: "monalisa",
    src: "/images/editorial/monalisa.webp",
    title: "La Gioconda",
    subtitle: "Acetato Negro · Edición Limitada",
    year: "S. XVI",
    credit: "Leonardo da Vinci",
  },
  {
    id: "venus",
    src: "/images/editorial/filmmaker-venus-calypso.png",
    title: "El Nacimiento",
    subtitle: "Montura Dorada · Geométrica",
    year: "S. XV",
    credit: "Sandro Botticelli",
  },
  {
    id: "dali",
    src: "/images/editorial/filmmaker-dali.webp",
    title: "La Persistencia",
    subtitle: "Marco Carei · Detalles en Oro",
    year: "S. XX",
    credit: "Salvador Dalí",
  },
  {
    id: "pearl",
    src: "/images/editorial/filmmaker-pearl.webp",
    title: "La Chica de la Perla",
    subtitle: "Wire Frame · Redondo",
    year: "S. XVII",
    credit: "Johannes Vermeer",
  },
  {
    id: "frida",
    src: "/images/editorial/filmmaker-frida.webp",
    title: "La Frida",
    subtitle: "Carey · Oversized",
    year: "S. XX",
    credit: "Frida Kahlo",
  },
];

export function FilmmakerReel() {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrent(prev => (prev + 1) % FRAMES.length);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    // Reset timer on manual nav
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrent(prev => (prev + 1) % FRAMES.length);
      }, 5000);
    }
  };

  const frame = FRAMES[current];

  return (
    <section className="relative w-full bg-black overflow-hidden" style={{ height: "100svh", minHeight: 560 }}>
      
      {/* ─── FILM GRAIN OVERLAY ─── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* ─── LETTERBOX BARS ─── */}
      <div className="absolute top-0 left-0 right-0 h-[6%] bg-black z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-[6%] bg-black z-20" />

      {/* ─── IMAGES ─── */}
      {!mounted ? (
        <div className="absolute inset-0">
          <div className="w-full h-full relative">
            <Image
              src="/images/editorial/filmmaker-monalisa.webp"
              alt="La Gioconda"
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </div>
          {/* Gradient overlays — cinematic vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={frame.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 1.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Ken Burns slow zoom */}
            <motion.div
              className="w-full h-full relative"
              initial={{ scale: 1 }}
              animate={{ scale: 1.06 }}
              transition={{ duration: 5, ease: "linear" }}
            >
              <Image
                src={frame.src}
                alt={frame.title}
                fill
                priority={current === 0}
                className="object-cover"
                sizes="100vw"
              />
            </motion.div>
            {/* Gradient overlays — cinematic vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          </motion.div>
        </AnimatePresence>
      )}

      {/* ─── FILM COUNTER / TIMECODE ─── */}
      <div className="absolute top-[15%] left-6 z-30 font-mono text-[10px] text-white/40 tracking-widest select-none">
        {String(current + 1).padStart(2, "0")} / {String(FRAMES.length).padStart(2, "0")} &nbsp;·&nbsp; ATELIER FILMS
      </div>

      {/* ─── PLAY INDICATOR DOT ─── */}
      <div className="absolute top-[15%] right-6 z-30 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? "bg-red-500 animate-pulse" : "bg-white/40"}`} />
        <span className="font-mono text-[9px] text-white/40 tracking-widest">{isPlaying ? "REC" : "PAUSED"}</span>
      </div>

      {/* ─── TEXT OVERLAY ─── */}
      <div className="absolute bottom-[10%] left-6 lg:left-16 z-30 max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={frame.id + "-text"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {/* Local SEO & Google Review Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3 select-none">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/10 text-white px-2.5 py-1.5 backdrop-blur-md rounded-full flex items-center gap-1">
                <span className="text-amber-500 text-[10px]">📍</span> Cerro de las Rosas, Córdoba
              </span>
              <a 
                href="https://www.google.com/maps?cid=14830223812501661125"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-black uppercase tracking-[0.2em] bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 backdrop-blur-md rounded-full flex items-center gap-1 transition-colors"
              >
                <span className="text-amber-500">★</span> 5.0 Google (89+ reseñas) · Verificada
              </a>
            </div>

            {/* Credit line */}
            <p className="text-white/40 font-mono text-[10px] tracking-[0.25em] uppercase mb-3">
              {frame.credit} &nbsp;·&nbsp; {frame.year}
            </p>
            {/* Title */}
            <h2
              className=" font-serif"
            >
              {frame.title}
            </h2>
            {/* Subtitle / product */}
            <p className="text-white/80 text-sm md:text-base font-light tracking-[0.15em] uppercase mb-1">
              {frame.subtitle}
            </p>
            <p className="text-white/60 text-xs md:text-sm font-light">
              Diseño de autor en 6 cuotas sin interés y envío gratis a todo el país.
            </p>

            {/* Subtle CTA Buttons */}
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/tienda"
                className="px-8 py-3.5 bg-white text-black text-[12px] font-black uppercase tracking-widest hover:bg-white/95 transition-all rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                Explorar Colección
              </Link>
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`Hola, vi los anteojos de diseño "${frame.title}" en su web y me gustaría recibir asesoramiento.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 border border-white/30 hover:border-white text-white text-[12px] font-black uppercase tracking-widest transition-all rounded-full flex items-center gap-2 backdrop-blur-sm bg-black/20"
              >
                Recibir Asesoramiento
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── PROGRESS BAR ─── */}
      <div className="absolute bottom-[7%] left-6 lg:left-16 right-6 lg:right-16 z-30 flex items-center gap-3">
        {FRAMES.map((f, idx) => (
          <button
            key={f.id}
            onClick={() => goTo(idx)}
            className="flex-1 h-[2px] bg-white/20 relative overflow-hidden rounded-full"
            aria-label={`Ver ${f.title}`}
          >
            {idx === current && (
              <motion.div
                className="absolute inset-y-0 left-0 bg-white rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5, ease: "linear" }}
                key={frame.id + "-bar"}
              />
            )}
            {idx < current && (
              <div className="absolute inset-0 bg-white/60 rounded-full" />
            )}
          </button>
        ))}

        {/* Pause/Play */}
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="ml-2 text-white/40 hover:text-white transition-colors"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* ─── FRAME THUMBNAILS (right side) ─── */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col gap-3">
        {FRAMES.map((f, idx) => (
          <button
            key={f.id}
            onClick={() => goTo(idx)}
            className={`w-14 h-10 rounded overflow-hidden border-2 transition-all duration-300 relative ${
              idx === current ? "border-white opacity-100 scale-105" : "border-white/20 opacity-40 hover:opacity-70"
            }`}
          >
            <Image 
              src={f.src} 
              alt={f.title} 
              fill
              sizes="56px"
              className="object-cover" 
            />
          </button>
        ))}
      </div>
    </section>
  );
}
