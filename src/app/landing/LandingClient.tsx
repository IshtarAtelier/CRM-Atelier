"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Star,
  Diamond,
  Glasses,
  ShieldCheck,
  Eye,
  Truck,
  CreditCard,
  MapPin,
  X,
} from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";

export interface LandingProduct {
  name: string;
  price: string;
  img: string;
  slug: string;
}

interface LandingClientProps {
  reviewCount?: number;
  rating?: number;
  products?: LandingProduct[];
}

// Retratos editoriales del home (FilmmakerReel) — mantienen la identidad visual.
const HERO_FRAMES = [
  "/images/editorial/filmmaker-frida.webp",
  "/images/editorial/monalisa.webp",
  "/images/editorial/filmmaker-venus.webp",
  "/images/editorial/filmmaker-dali.webp",
  "/images/editorial/filmmaker-pearl.webp",
];

// Fondo del hero: crossfade de retratos editoriales en CSS puro (sin depender de
// que framer dispare la animación) para que el hero nunca quede negro ni el
// contenido dependa del motor de animación.
function HeroBackdrop() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((p) => (p + 1) % HERO_FRAMES.length), 4500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {HERO_FRAMES.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{ opacity: i === frame ? 0.35 : 0 }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className="object-cover object-center grayscale mix-blend-luminosity"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/70 to-[#0F0F0F]/40" />
    </div>
  );
}

export function LandingClient({
  reviewCount = 642,
  rating = 5.0,
  products = [],
}: LandingClientProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // WhatsApp — canal principal de conversión
  const [isRedirecting, setIsRedirecting] = useState(false);
  const waMessage =
    "Hola Atelier! 👋 Vi sus anteojos en la web y quiero recibir asesoramiento y un presupuesto.";
  const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(waMessage)}`;

  // Exit intent
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasSeenPopup) {
        setShowExitPopup(true);
        setHasSeenPopup(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [hasSeenPopup]);

  const handleWhatsAppClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    e.preventDefault();
    if (isRedirecting) return;
    setIsRedirecting(true);
    setTimeout(() => {
      window.open(waUrl, "_blank", "noopener,noreferrer");
      setIsRedirecting(false);
    }, 800);
  };

  const toggleFaq = (index: number) => setOpenFaq(openFaq === index ? null : index);

  const ratingStr = rating.toFixed(1);

  const productList = products.length > 0 ? products : [];

  const benefits = [
    {
      icon: Diamond,
      title: "Diseño de autor",
      desc: "Colección curada en acetato italiano y metales nobles. Piezas pensadas para destacar tu mirada.",
    },
    {
      icon: Eye,
      title: "Cristales premium",
      desc: "Multifocales Varilux, antirreflex y filtro azul. Tallado digital de laboratorio de primera línea.",
    },
    {
      icon: ShieldCheck,
      title: "Garantía de adaptación",
      desc: "Si no te adaptás a tus multifocales, cambiamos los cristales sin costo. Comprás con respaldo.",
    },
  ];

  const steps = [
    { num: 1, title: "Elegí tu armazón", desc: "Te mostramos la colección" },
    { num: 2, title: "Elegí tus cristales", desc: "A tu medida exacta" },
    { num: 3, title: "Enviá tu receta", desc: "Por WhatsApp, es al instante" },
    { num: 4, title: "Recibí tus lentes", desc: "En el local o a domicilio" },
  ];

  const faqs = [
    {
      question: "¿Puedo hacer el pedido si estoy en otra provincia?",
      answer:
        "Sí. Hacemos envíos a todo el país. Coordinamos tu receta y graduación por WhatsApp y te llegan tus lentes a domicilio.",
    },
    {
      question: "¿Cómo pago? ¿Hay cuotas?",
      answer:
        "Trabajamos con cuotas sin interés y todos los medios de pago. En el presupuesto te detallamos el plan que más te convenga.",
    },
    {
      question: "¿Qué es un cristal multifocal y para quién se recomienda?",
      answer:
        "Los multifocales integran visión de lejos, intermedia y cerca en un solo cristal sin líneas visibles. Ideales para presbicia.",
    },
    {
      question: "Tengo mucha graduación, ¿quedarán gruesos?",
      answer:
        "Trabajamos con cristales de alto índice (súper delgados) que reducen el espesor. Te asesoramos para elegir el armazón ideal.",
    },
  ];

  const reviews = [
    { name: "María G.", text: "Excelente atención y los anteojos me quedaron perfectos. Muy rápidos.", initial: "M" },
    { name: "Carlos S.", text: "Me asesoraron por WhatsApp con mi receta. Calidad superior, 100% recomendados.", initial: "C" },
    { name: "Lucía P.", text: "Hermosos diseños y la atención impecable. Volvería a comprar sin dudarlo.", initial: "L" },
  ];

  return (
    <div className="min-h-screen bg-[#FCFCFC] font-sans selection:bg-[#C5A059] selection:text-white">
      {/* Header minimalista (anti-fugas: sin menú de navegación) */}
      <header className="w-full bg-[#0F0F0F] border-b border-white/10 py-5 px-6 flex justify-center sticky top-0 z-40">
        <div className="text-xl font-serif text-[#C5A059] tracking-[0.3em] uppercase">
          Atelier
        </div>
      </header>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative w-full bg-[#0F0F0F] pt-20 pb-28 px-6 overflow-hidden min-h-[90vh] flex items-center">
        {/* Retratos editoriales del home en crossfade (aislado) */}
        <HeroBackdrop />

        {/* Contenido siempre visible: no dependemos de la animación de entrada
            para mostrar el titular ni el CTA (crítico en una landing de ads). */}
        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center animate-[fadeInUp_0.7s_ease-out]">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold tracking-widest uppercase mb-8">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
            Óptica de autor · Córdoba
          </div>

          <h1 className="text-4xl md:text-7xl font-serif text-white leading-tight mb-6">
            Anteojos que <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C5A059] to-[#D4AF37]">
              destacan tu mirada
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 font-light mb-10 max-w-2xl leading-relaxed">
            Diseño exclusivo y <strong className="text-white font-medium">cristales premium</strong> con
            asesoramiento personalizado. Cuotas sin interés y envíos a todo el país.
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleWhatsAppClick}
            className="group relative px-8 py-5 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-base uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(197,160,89,0.35)] w-full sm:w-auto rounded-sm"
          >
            {isRedirecting ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5 text-[#0F0F0F]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Conectando seguro...
              </span>
            ) : (
              "Pedí tu presupuesto por WhatsApp"
            )}
          </motion.button>

          <div className="mt-6 flex items-center gap-2 text-[#C5A059]/90 text-sm">
            <div className="flex text-[#C5A059]">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <span className="text-gray-300">
              {ratingStr} · {reviewCount} reseñas en Google
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════ TRUST BAR ═══════════════ */}
      <section className="w-full bg-[#0F0F0F] border-t border-white/10 py-6 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          {[
            { icon: CreditCard, label: "Cuotas sin interés" },
            { icon: Truck, label: "Envíos a todo el país" },
            { icon: MapPin, label: "Retiro gratis en el local" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-3 text-gray-300">
              <item.icon className="w-5 h-5 text-[#C5A059]" strokeWidth={1.5} />
              <span className="text-sm font-medium uppercase tracking-wider">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ BENEFICIOS ═══════════════ */}
      <section className="py-24 px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] mb-4">
              Por qué elegir Atelier
            </h2>
            <p className="text-gray-500 text-base">
              Diseño de autor y tecnología óptica, con la atención de una óptica boutique.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="flex flex-col items-center text-center p-8 bg-[#FCFCFC] border border-gray-100 shadow-sm rounded-2xl"
              >
                <div className="w-16 h-16 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 flex items-center justify-center mb-6 text-[#C5A059]">
                  <b.icon className="w-7 h-7" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold mb-3 uppercase tracking-wider text-[#0F0F0F]">
                  {b.title}
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PRODUCTOS DESTACADOS ═══════════════ */}
      {productList.length > 0 && (
        <section className="py-24 px-6 bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] mb-4">
                Algunos de nuestros modelos
              </h2>
              <p className="text-gray-500 text-base">
                Diseño exclusivo en cuotas sin interés. Y muchísimos más en el salón.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {productList.slice(0, 4).map((p, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -10 }}
                  className="group relative bg-[#FCFCFC] border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="relative h-48 md:h-60 w-full bg-white">
                    <Image
                      unoptimized
                      src={p.img}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-contain p-6 mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5 border-t border-gray-100 bg-[#FCFCFC]">
                    <h4 className="text-base font-bold text-[#0F0F0F] truncate">{p.name}</h4>
                    {p.price && (
                      <p className="text-sm text-[#C5A059] font-medium mt-1">{p.price}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <button
                onClick={handleWhatsAppClick}
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#0F0F0F] text-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white font-bold text-sm uppercase tracking-widest transition-colors rounded-sm"
              >
                Ver la colección completa por WhatsApp
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ ARMÁ TUS LENTES (4 pasos) ═══════════════ */}
      <section className="py-24 px-6 bg-[#f2f2f2] flex flex-col items-center text-center overflow-hidden">
        <h2 className="text-2xl md:text-4xl font-serif uppercase tracking-tight mb-16 text-[#0F0F0F]">
          Armá tus anteojos graduados
        </h2>

        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-12 md:gap-4 mb-16 relative">
          <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-[1px] bg-black/10 z-0" />
          <div className="md:hidden absolute top-0 bottom-0 left-1/2 w-[1px] bg-black/10 -translate-x-1/2 z-0" />

          {steps.map((step) => (
            <div
              key={step.num}
              className="flex flex-col items-center relative z-10 bg-[#f2f2f2] px-4"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold mb-4 shadow-sm ${
                  step.num === 1 ? "bg-[#0F0F0F] text-white" : "bg-white border border-black/10 text-black"
                }`}
              >
                {step.num}
              </div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest mb-1.5 text-[#0F0F0F]">
                {step.title}
              </h3>
              <p className="text-[9px] text-[#999] uppercase tracking-[0.2em]">{step.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleWhatsAppClick}
          className="px-10 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white bg-[#0F0F0F] border border-[#0F0F0F] rounded-full hover:bg-[#C5A059] hover:border-[#C5A059] hover:text-[#0F0F0F] transition-all duration-300 shadow-lg"
        >
          Cotizá tus lentes en 60 segundos
        </button>
        <span className="text-[11px] text-stone-500 font-medium tracking-wide max-w-md mt-5">
          📍 Retirá gratis en nuestro local del Cerro de las Rosas o recibilo a domicilio en todo el país.
        </span>
      </section>

      {/* ═══════════════ EDITORIAL (guiño al home) ═══════════════ */}
      <section className="py-24 px-6 bg-[#0F0F0F] text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold tracking-widest uppercase mb-6">
              Colección editorial
            </div>
            <h2 className="text-3xl md:text-5xl font-serif mb-6 leading-tight">
              Inspirados en las <span className="text-[#C5A059]">grandes obras</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed font-light">
              Cada montura es una pieza de diseño. Curamos una colección de acetato italiano
              y metales nobles pensada para acompañar tu estilo, no para pasar desapercibida.
              Contanos qué buscás y te ayudamos a encontrar la tuya.
            </p>
            <button
              onClick={handleWhatsAppClick}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-sm uppercase tracking-widest transition-colors rounded-sm"
            >
              Quiero que me asesoren
            </button>
          </div>
          <div className="relative h-[460px] w-full rounded-3xl overflow-hidden border border-white/10">
            <Image
              src="/images/editorial/filmmaker-frida.webp"
              alt="Colección editorial Atelier"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[#0F0F0F] via-transparent to-transparent" />
          </div>
        </div>
      </section>

      {/* ═══════════════ PRUEBA SOCIAL ═══════════════ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <div className="flex text-[#C5A059] mb-4">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-6 h-6 fill-current" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] mb-6">
              {ratingStr} de calificación · {reviewCount} reseñas reales
            </h2>
            <a
              href="https://maps.app.goo.gl/atelieroptica"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#0F0F0F] border-b border-[#C5A059] pb-1 hover:text-[#C5A059] transition-colors text-sm font-bold uppercase tracking-widest"
            >
              Ver las reseñas en Google
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((rev, i) => (
              <div key={i} className="bg-[#FCFCFC] p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#C5A059]/15 text-[#C5A059] flex items-center justify-center font-serif text-xl">
                    {rev.initial}
                  </div>
                  <div>
                    <h4 className="text-[#0F0F0F] font-medium text-base">{rev.name}</h4>
                    <div className="flex text-[#C5A059] mt-1">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-base leading-relaxed italic">
                  &quot;{rev.text}&quot;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="py-24 px-6 bg-[#FCFCFC] border-t border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] text-center mb-12">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  aria-expanded={openFaq === i}
                >
                  <span
                    className={`text-base font-bold transition-colors ${
                      openFaq === i ? "text-[#C5A059]" : "text-[#0F0F0F]"
                    }`}
                  >
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 shrink-0 ${
                      openFaq === i ? "rotate-180 text-[#C5A059]" : ""
                    }`}
                  />
                </button>
                <div
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === i ? "max-h-96 pb-5 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-gray-600 text-base leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="py-24 px-6 bg-[#0F0F0F] text-center border-t border-white/10">
        <h2 className="text-4xl md:text-5xl font-serif text-white mb-4">
          Tu próxima mirada empieza acá
        </h2>
        <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
          Escribinos y en minutos te armamos un presupuesto sin compromiso.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleWhatsAppClick}
          className="px-10 py-5 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-base uppercase tracking-widest transition-colors w-full sm:w-auto shadow-[0_0_30px_rgba(197,160,89,0.3)] rounded-sm"
        >
          {isRedirecting ? "Conectando..." : "Pedir presupuesto por WhatsApp"}
        </motion.button>
      </section>

      {/* Footer minimalista */}
      <footer className="w-full bg-[#FCFCFC] py-12 px-6 border-t border-gray-200 text-center">
        <p className="text-gray-400 text-sm">
          © 2026 ATELIER ÓPTICA. José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba.
        </p>
      </footer>

      {/* El WhatsApp flotante persistente lo inyecta el layout raíz
          (<FloatingWhatsApp/>), así que acá no lo duplicamos. */}

      {/* Exit intent */}
      <AnimatePresence>
        {showExitPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowExitPopup(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0F0F0F] border border-[#C5A059]/20 rounded-3xl p-10 text-center shadow-2xl z-10"
            >
              <button
                onClick={() => setShowExitPopup(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="w-16 h-16 mx-auto bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-full flex items-center justify-center mb-6 text-[#C5A059]">
                <Glasses className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-serif text-white mb-4">¡Esperá! Un asesor te espera</h2>
              <p className="text-gray-400 text-base mb-8">
                Contanos qué buscás y te armamos un <strong className="text-white">presupuesto sin compromiso</strong> por WhatsApp ahora mismo.
              </p>
              <button
                onClick={(e) => {
                  setShowExitPopup(false);
                  handleWhatsAppClick(e);
                }}
                className="w-full py-4 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold uppercase tracking-widest text-sm transition-colors rounded-sm"
              >
                Hablar con un asesor
              </button>
              <button
                onClick={() => setShowExitPopup(false)}
                className="mt-4 text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wider underline underline-offset-4"
              >
                Ahora no, gracias
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
