"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Star, X, Glasses } from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { CAMPAIGNS, type LandingProduct } from "@/lib/landing/campaigns";

// ── Créditos de obra para los retratos editoriales (mismo espíritu que FilmmakerReel) ──
const FRAME_CREDITS: Record<string, string> = {
  "/images/editorial/filmmaker-frida.webp": "La Frida · Carey Oversized — S. XX",
  "/images/editorial/monalisa.webp": "La Gioconda · Leonardo da Vinci — S. XVI",
  "/images/editorial/filmmaker-venus.webp": "El Nacimiento · Sandro Botticelli — S. XV",
  "/images/editorial/filmmaker-dali.webp": "La Persistencia · Salvador Dalí — S. XX",
  "/images/editorial/filmmaker-pearl.webp": "La Chica de la Perla · Johannes Vermeer — S. XVII",
};

const MARQUEE_ITEMS = [
  "Colección de Diseño",
  "Acetato Italiano",
  "Hechos para destacar tu mirada",
  "Curaduría Exclusiva",
];

interface LandingClientProps {
  slug?: string;
  reviewCount?: number;
  rating?: number;
  products?: LandingProduct[];
}

// Fondo del hero: crossfade en CSS puro + crédito de obra. El contenido del hero
// nunca depende del motor de animación (SSR siempre visible).
function HeroBackdrop({ images }: { images: string[] }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setFrame((p) => (p + 1) % images.length), 5000);
    return () => clearInterval(id);
  }, [images.length]);

  const credit = FRAME_CREDITS[images[frame]] ?? "";

  return (
    <>
      <div className="absolute inset-0 pointer-events-none">
        {images.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-[1800ms] ease-in-out"
            style={{ opacity: i === frame ? 0.9 : 0 }}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover object-[center_18%] grayscale"
            />
          </div>
        ))}
        {/* Scrims: proteger legibilidad sin apagar el retrato */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F0F0F] via-[#0F0F0F]/55 to-[#0F0F0F]/10 hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/45 to-[#0F0F0F]/15 md:via-[#0F0F0F]/20 md:to-transparent" />
      </div>
      {credit && (
        <div className="absolute bottom-6 right-6 z-10 text-right hidden sm:block">
          <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40 transition-opacity duration-700">
            {credit}
          </p>
        </div>
      )}
    </>
  );
}

function Kicker({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="block w-8 h-[1px] bg-[#C5A059]" />
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.3em] ${light ? "text-[#C5A059]" : "text-[#C5A059]"}`}
      >
        {children}
      </span>
    </div>
  );
}

function Marquee() {
  return (
    <div className="w-full bg-[#0F0F0F] border-y border-white/10 py-3 overflow-hidden">
      <div className="flex w-max gap-0" style={{ animation: "marquee 30s linear infinite" }}>
        {[...Array(2)].map((_, i) => (
          <span
            key={i}
            className="flex items-center gap-8 pr-8 text-[11px] font-bold uppercase tracking-[0.25em] text-white/50 whitespace-nowrap"
          >
            {MARQUEE_ITEMS.map((item) => (
              <React.Fragment key={item}>
                <span>{item}</span>
                <span className="text-[#C5A059]/40">·</span>
              </React.Fragment>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LandingClient({
  slug = "default",
  reviewCount = 642,
  rating = 5.0,
  products = [],
}: LandingClientProps) {
  const config = CAMPAIGNS[slug] ?? CAMPAIGNS.default;

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [attribution, setAttribution] = useState("");

  const [showExitPopup, setShowExitPopup] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);

  // Captura de UTMs del anuncio + exit intent
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const utmSource = p.get("utm_source");
      const utmCampaign = p.get("utm_campaign");
      const gclid = p.get("gclid");
      const fbclid = p.get("fbclid");
      let referrerHost = "";
      try {
        referrerHost = document.referrer ? new URL(document.referrer).hostname : "";
      } catch {
        referrerHost = "";
      }
      const origen =
        utmSource || (gclid ? "google-ads" : "") || (fbclid ? "meta-ads" : "") || referrerHost;

      let line = `\n\n— Campaña: ${config.slug}`;
      if (utmCampaign) line += ` (${utmCampaign})`;
      if (origen) line += ` · origen: ${origen}`;
      setAttribution(line);
    } catch {
      setAttribution(`\n\n— Campaña: ${config.slug}`);
    }

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasSeenPopup) {
        setShowExitPopup(true);
        setHasSeenPopup(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [config.slug, hasSeenPopup]);

  const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    config.waMessageBase + attribution,
  )}`;

  const handleWhatsAppClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    e.preventDefault();
    if (isRedirecting) return;

    // Evento de conversión para que Meta/Google optimicen por leads.
    try {
      const w = window as unknown as {
        fbq?: (...a: unknown[]) => void;
        gtag?: (...a: unknown[]) => void;
      };
      w.fbq?.("track", "Lead", { content_name: config.slug });
      w.gtag?.("event", "generate_lead", { campaign: config.slug });
    } catch {
      /* los píxeles pueden no estar configurados; no debe romper el click */
    }

    setIsRedirecting(true);
    setTimeout(() => {
      window.open(waUrl, "_blank", "noopener,noreferrer");
      setIsRedirecting(false);
    }, 800);
  };

  const toggleFaq = (index: number) => setOpenFaq(openFaq === index ? null : index);

  const ratingStr = rating.toFixed(1);
  const productList = products.length > 0 ? products : [];

  const steps = [
    { num: "01", title: "Elegí tu armazón", desc: "Te mostramos la colección" },
    { num: "02", title: "Elegí tus cristales", desc: "A tu medida exacta" },
    { num: "03", title: "Enviá tu receta", desc: "Por WhatsApp, es al instante" },
    { num: "04", title: "Recibí tus lentes", desc: "En el local o a domicilio" },
  ];

  const reviews = [
    { name: "María G.", text: "Excelente atención y los anteojos me quedaron perfectos. Muy rápidos.", initial: "M" },
    { name: "Carlos S.", text: "Me asesoraron por WhatsApp con mi receta. Calidad superior, 100% recomendados.", initial: "C" },
    { name: "Lucía P.", text: "Hermosos diseños y la atención impecable. Volvería a comprar sin dudarlo.", initial: "L" },
  ];

  const goldButton =
    "inline-flex items-center justify-center px-10 py-5 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-[12px] uppercase tracking-[0.2em] transition-all duration-300 shadow-[0_0_40px_rgba(197,160,89,0.25)]";

  const Spinner = (
    <span className="flex items-center justify-center gap-3">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      Conectando seguro...
    </span>
  );

  return (
    <div className="min-h-screen bg-[#FBFAF8] font-sans text-[#0F0F0F] selection:bg-[#C5A059] selection:text-white">
      {/* Header minimalista (anti-fugas) */}
      <header className="w-full bg-[#0F0F0F] border-b border-white/10 py-5 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 hidden sm:block">
            Óptica de autor
          </span>
          <span className="text-xl font-serif text-[#C5A059] tracking-[0.35em] uppercase">Atelier</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 hidden sm:block">
            Córdoba · Arg
          </span>
        </div>
      </header>

      {/* ═══════════════ HERO EDITORIAL ═══════════════ */}
      <section className="relative w-full bg-[#0F0F0F] min-h-[92svh] flex items-end md:items-center overflow-hidden">
        <HeroBackdrop images={config.hero.images} />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
          <div className="max-w-3xl">
            <Kicker light>{config.hero.badge}</Kicker>

            <h1 className="font-serif text-white leading-[0.98] tracking-tight text-[clamp(2.6rem,7.5vw,6.5rem)] mb-8">
              {config.hero.title}
              <br />
              <em className="not-italic md:italic text-transparent bg-clip-text bg-gradient-to-r from-[#C5A059] to-[#E2C784]">
                {config.hero.titleAccent}
              </em>
            </h1>

            <p className="text-base md:text-lg text-stone-300 font-light leading-relaxed max-w-xl mb-10">
              {config.hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWhatsAppClick}
                className={`${goldButton} w-full sm:w-auto`}
              >
                {isRedirecting ? Spinner : config.primaryCta}
              </motion.button>

              <div className="flex items-center gap-2.5">
                <div className="flex text-[#C5A059]">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-300">
                  {ratingStr} — {reviewCount} reseñas en Google
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ MARQUEE (firma del home) ═══════════════ */}
      <Marquee />

      {/* ═══════════════ TRUST — hairline strip ═══════════════ */}
      <section className="w-full bg-[#FBFAF8] border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-6 md:px-10 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06]">
          {["Cuotas sin interés", "Envíos a todo el país", "Retiro gratis en el local"].map((t) => (
            <div key={t} className="py-5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ BENEFICIOS — columnas editoriales ═══════════════ */}
      <section className="py-28 px-6 md:px-10 bg-[#FBFAF8]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 max-w-2xl">
            <Kicker>Por qué Atelier</Kicker>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Diseño de autor, con la atención de una <em className="italic text-[#8a6f3d]">óptica boutique</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
            {config.benefits.map((b, i) => (
              <div key={i} className="border-t border-black/15 pt-6">
                <span className="font-serif italic text-[#C5A059] text-2xl">0{i + 1}</span>
                <h3 className="mt-4 mb-3 text-[13px] font-bold uppercase tracking-[0.2em]">{b.title}</h3>
                <p className="text-[15px] leading-relaxed text-stone-600">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PRODUCTOS — tiles editoriales ═══════════════ */}
      {productList.length > 0 && (
        <section className="pb-28 px-6 md:px-10 bg-[#FBFAF8]">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10 border-t border-black/15 pt-8">
              <div>
                <h2 className="text-[13px] font-bold uppercase tracking-[0.05em]">
                  Selección: {config.productsHeading}
                </h2>
                <p className="text-[13px] text-stone-500 mt-1">{config.productsSubheading}</p>
              </div>
              <button
                onClick={handleWhatsAppClick}
                className="text-[12px] font-bold uppercase tracking-[0.15em] underline underline-offset-4 decoration-[#C5A059] decoration-2 hover:opacity-60 transition-opacity text-left"
              >
                Solicitar catálogo completo por WhatsApp
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/[0.06] border border-black/[0.06]">
              {productList.slice(0, 4).map((p, i) => (
                <div key={i} className="group bg-white">
                  <div className="relative h-48 md:h-64 w-full overflow-hidden">
                    <Image
                      unoptimized={String(p.img).startsWith('data:')}
                      src={p.img}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-contain p-7 md:p-9 mix-blend-multiply transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                  </div>
                  <div className="px-5 pb-6">
                    <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] truncate">{p.name}</h4>
                    {p.price && <p className="text-[11px] text-stone-500 mt-1">{p.price}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ EDITORIAL — negro, obra + relato ═══════════════ */}
      <section className="bg-[#0F0F0F] text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2">
          <div className="relative min-h-[420px] md:min-h-[640px] order-1 md:order-none">
            <Image
              src={config.editorial.image}
              alt="Colección editorial Atelier"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-[center_15%] grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F]/60 via-transparent to-transparent" />
            {FRAME_CREDITS[config.editorial.image] && (
              <p className="absolute bottom-5 left-6 text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
                {FRAME_CREDITS[config.editorial.image]}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-center px-6 md:px-16 py-20 md:py-32">
            <Kicker light>{config.editorial.badge}</Kicker>
            <h2 className="font-serif text-4xl md:text-5xl leading-[1.05] mb-8">
              {config.editorial.title}{" "}
              <em className="italic text-[#C5A059]">{config.editorial.titleAccent}</em>
            </h2>
            <p className="text-stone-400 text-lg font-light leading-relaxed mb-10 max-w-md">
              {config.editorial.copy}
            </p>
            <button onClick={handleWhatsAppClick} className={`${goldButton} w-full sm:w-auto self-start`}>
              {config.editorial.cta}
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ PASOS — proceso ═══════════════ */}
      <section className="py-28 px-6 md:px-10 bg-[#FBFAF8]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 max-w-2xl">
            <Kicker>El proceso</Kicker>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight">
              Armá tus anteojos <em className="italic text-[#8a6f3d]">en cuatro pasos</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 mb-16">
            {steps.map((step) => (
              <div key={step.num} className="border-t border-black/15 pt-6">
                <span className="font-serif italic text-[#C5A059] text-2xl">{step.num}</span>
                <h3 className="mt-4 mb-2 text-[12px] font-bold uppercase tracking-[0.2em]">{step.title}</h3>
                <p className="text-[13px] text-stone-500">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <button onClick={handleWhatsAppClick} className={`${goldButton} w-full sm:w-auto`}>
              Cotizá tus lentes en 60 segundos
            </button>
            <span className="text-[12px] text-stone-500">
              📍 Retirá gratis en Cerro de las Rosas o recibilo en todo el país.
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════ PRUEBA SOCIAL ═══════════════ */}
      <section className="py-28 px-6 md:px-10 bg-white border-y border-black/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex justify-center text-[#C5A059] mb-5">
              {[...Array(5)].map((_, j) => (
                <Star key={j} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <h2 className="font-serif text-4xl md:text-5xl mb-5">
              {ratingStr} · <em className="italic">{reviewCount} reseñas reales</em>
            </h2>
            <a
              href="https://maps.app.goo.gl/atelieroptica"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-bold uppercase tracking-[0.15em] underline underline-offset-4 decoration-[#C5A059] decoration-2 hover:opacity-60 transition-opacity"
            >
              Ver las reseñas en Google
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
            {reviews.map((rev, i) => (
              <div key={i} className="border-t border-black/15 pt-6">
                <p className="font-serif italic text-lg leading-relaxed text-stone-700 mb-6">
                  &ldquo;{rev.text}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-[#C5A059]/15 text-[#8a6f3d] flex items-center justify-center font-serif">
                    {rev.initial}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {rev.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ — lista hairline ═══════════════ */}
      <section className="py-28 px-6 md:px-10 bg-[#FBFAF8]">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <Kicker>Dudas frecuentes</Kicker>
            <h2 className="font-serif text-4xl md:text-5xl">Preguntas, <em className="italic text-[#8a6f3d]">respondidas</em></h2>
          </div>
          <div>
            {config.faqs.map((faq, i) => (
              <div key={i} className="border-t border-black/15 last:border-b">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full py-6 flex justify-between items-center gap-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  aria-expanded={openFaq === i}
                >
                  <span className={`text-[15px] font-semibold transition-colors ${openFaq === i ? "text-[#8a6f3d]" : ""}`}>
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180 text-[#C5A059]" : "text-stone-400"}`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? "max-h-96 pb-6 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <p className="text-[15px] leading-relaxed text-stone-600 max-w-2xl">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA FINAL ═══════════════ */}
      <section className="bg-[#0F0F0F] text-center px-6 py-32 border-t border-white/10">
        <Kicker light>
          <span className="mx-auto">Presupuesto en el acto</span>
        </Kicker>
        <h2 className="font-serif text-white leading-[1.02] text-[clamp(2.4rem,6vw,5rem)] max-w-4xl mx-auto mb-6">
          {config.finalCtaTitle}
        </h2>
        <p className="text-stone-400 text-lg font-light mb-12 max-w-xl mx-auto">{config.finalCtaSubtitle}</p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleWhatsAppClick}
          className={`${goldButton} w-full sm:w-auto`}
        >
          {isRedirecting ? "Conectando..." : config.finalCta}
        </motion.button>
      </section>

      <Marquee />

      {/* Footer minimalista */}
      <footer className="w-full bg-[#0F0F0F] py-10 px-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
          © 2026 Atelier Óptica — José Luis de Tejeda 4380, Cerro de las Rosas, Córdoba
        </p>
      </footer>

      {/* El WhatsApp flotante persistente lo inyecta el layout raíz (<FloatingWhatsApp/>). */}

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
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              className="relative w-full max-w-lg bg-[#0F0F0F] border border-[#C5A059]/30 p-10 text-center shadow-2xl z-10"
            >
              <button
                onClick={() => setShowExitPopup(false)}
                className="absolute top-5 right-5 text-stone-500 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
              <Glasses className="w-8 h-8 mx-auto mb-6 text-[#C5A059]" strokeWidth={1.25} />
              <h2 className="font-serif text-3xl text-white mb-4">¡Esperá! Un asesor te espera</h2>
              <p className="text-stone-400 text-[15px] leading-relaxed mb-8">
                Contanos qué buscás y te armamos un{" "}
                <strong className="text-white font-medium">presupuesto sin compromiso</strong> por WhatsApp
                ahora mismo.
              </p>
              <button
                onClick={(e) => {
                  setShowExitPopup(false);
                  handleWhatsAppClick(e);
                }}
                className={`${goldButton} w-full`}
              >
                Hablar con un asesor
              </button>
              <button
                onClick={() => setShowExitPopup(false)}
                className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 hover:text-stone-300 underline underline-offset-4"
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
