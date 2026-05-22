"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FRAMES = [
  {
    id: "monalisa",
    src: "/images/editorial/monalisa.png",
    title: "La Gioconda",
    subtitle: "Acetato Negro · Edición Limitada",
    year: "S. XVI",
    credit: "Leonardo da Vinci",
  },
  {
    id: "venus",
    src: "/images/editorial/filmmaker-venus.png",
    title: "El Nacimiento",
    subtitle: "Montura Dorada · Geométrica",
    year: "S. XV",
    credit: "Sandro Botticelli",
  },
  {
    id: "dali",
    src: "/images/editorial/filmmaker-dali.png",
    title: "La Persistencia",
    subtitle: "Marco Carei · Detalles en Oro",
    year: "S. XX",
    credit: "Salvador Dalí",
  },
  {
    id: "pearl",
    src: "/images/editorial/filmmaker-pearl.png",
    title: "La Chica de la Perla",
    subtitle: "Wire Frame · Redondo",
    year: "S. XVII",
    credit: "Johannes Vermeer",
  },
  {
    id: "frida",
    src: "/images/editorial/filmmaker-frida.png",
    title: "La Frida",
    subtitle: "Carey · Oversized",
    year: "S. XX",
    credit: "Frida Kahlo",
  },
];

export function FilmmakerReel() {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
          <motion.img
            src={frame.src}
            alt={frame.title}
            className="w-full h-full object-cover"
            initial={{ scale: 1 }}
            animate={{ scale: 1.06 }}
            transition={{ duration: 5, ease: "linear" }}
          />
          {/* Gradient overlays — cinematic vignette */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* ─── FILM COUNTER / TIMECODE ─── */}
      <div className="absolute top-[8%] left-6 z-30 font-mono text-[10px] text-white/40 tracking-widest select-none">
        {String(current + 1).padStart(2, "0")} / {String(FRAMES.length).padStart(2, "0")} &nbsp;·&nbsp; ATELIER FILMS
      </div>

      {/* ─── PLAY INDICATOR DOT ─── */}
      <div className="absolute top-[8%] right-6 z-30 flex items-center gap-2">
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
            {/* Credit line */}
            <p className="text-white/40 font-mono text-[10px] tracking-[0.25em] uppercase mb-3">
              {frame.credit} &nbsp;·&nbsp; {frame.year}
            </p>
            {/* Title */}
            <h2
              className="text-white text-4xl lg:text-6xl font-bold tracking-tight leading-none mb-3"
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            >
              {frame.title}
            </h2>
            {/* Subtitle / product */}
            <p className="text-white/60 text-sm font-light tracking-[0.15em] uppercase">
              {frame.subtitle}
            </p>
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
            className={`w-14 h-10 rounded overflow-hidden border-2 transition-all duration-300 ${
              idx === current ? "border-white opacity-100 scale-105" : "border-white/20 opacity-40 hover:opacity-70"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={f.title} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}
