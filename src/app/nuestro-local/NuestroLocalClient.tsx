"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { MapPin, Clock, Phone, ChevronDown, Sparkles, Eye, Coffee } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";

interface NuestroLocalClientProps {
  settings: {
    addressLine: string;
    localityLine: string;
    mapsUrl: string;
    phone: string;
    whatsappPhoneId: string;
  };
  reviewCount?: number;
  rating?: number;
  children?: React.ReactNode;
}

const GALLERY_IMAGES = [
  { src: "/images/blog/fachada-ladrillo.webp", alt: "Fachada de ladrillo de Atelier Óptica", caption: "Nuestra Fachada", aspect: "aspect-[4/5]" },
  { src: "/images/blog/mostrador-marmol.webp", alt: "Mostrador de mármol Atelier Óptica", caption: "El Mostrador", aspect: "aspect-[3/4]" },
  { src: "/images/blog/vidriera-atelier.webp", alt: "Vidriera de Atelier Óptica", caption: "La Vidriera", aspect: "aspect-[4/5]" },
  { src: "/images/blog/muestrario-smart-lens.webp", alt: "Muestrario de cristales inteligentes", caption: "Smart Lens Lab", aspect: "aspect-[3/4]" },
  { src: "/images/blog/local-varilux.webp", alt: "Espacio Varilux en Atelier Óptica", caption: "Espacio Varilux", aspect: "aspect-[4/5]" },
  { src: "/images/atelier-macro-film.webp", alt: "Macro detalle de anteojos Atelier", caption: "El Detalle", aspect: "aspect-[3/4]" },
];

const SERVICES = [
  {
    icon: Eye,
    title: "Visagismo Óptico",
    subtitle: "Asesoramiento de Imagen",
    description: "Analizamos la fisionomía de tu rostro, tu tono de piel y tu estilo personal para recomendarte el armazón perfecto. No es solo ver bien, es verte increíble.",
  },
  {
    icon: Sparkles,
    title: "Cristales Premium",
    subtitle: "Tecnología de Última Generación",
    description: "Somos especialistas en adaptación de cristales multifocales Varilux, tratamientos Crizal y Transitions. Trabajamos con los mejores laboratorios del mundo.",
  },
  {
    icon: Coffee,
    title: "Experiencia Boutique",
    subtitle: "Un Café, Tu Estilo",
    description: "Te invitamos a tomarte un café mientras explorás las mejores colecciones en un ambiente relajado, diseñado para que tu experiencia sea única e irrepetible.",
  },
];

export function NuestroLocalClient({ settings, reviewCount = 642, rating = 5.0, children }: NuestroLocalClientProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const [hoveredImage, setHoveredImage] = useState<number | null>(null);

  return (
    <div className="bg-[#faf8f5] min-h-screen text-[#1a1714] font-sans selection:bg-black selection:text-white overflow-x-hidden">
      <StorefrontNavbar theme="dark" />

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — Full-Screen Cinematic                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative w-full overflow-hidden" style={{ height: "100svh", minHeight: 600 }}>
        <motion.div className="absolute inset-0" style={{ y: heroY }}>
          <Image
            src="/images/blog/fachada-ladrillo.webp"
            alt="Fachada de Atelier Óptica en Cerro de las Rosas, Córdoba"
            fill
            priority
            unoptimized
            className="object-cover"
            sizes="100vw"
          />
        </motion.div>

        {/* Cinematic overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/70 z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/30 z-10" />

        {/* Content */}
        <motion.div
          className="absolute inset-0 z-20 flex flex-col justify-end pb-[12%] px-6 md:px-16 lg:px-24"
          style={{ opacity: heroOpacity }}
        >
          {/* Google Badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-4 py-2 shadow-2xl">
              <span className="text-amber-400 text-sm">★★★★★</span>
              <span className="text-white/90 text-[10px] font-black uppercase tracking-[0.15em]">{rating.toFixed(1)} en Google · {reviewCount} Reseñas</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white tracking-tight leading-[0.9] mb-4">
            Nuestro
            <br />
            <span className="italic font-light">Local</span>
          </h1>

          {/* Subtitle */}
          <p className="text-white/60 text-sm md:text-base max-w-lg leading-relaxed font-light mb-2">
            Una óptica boutique en el corazón del Cerro de las Rosas. Diseño, tecnología y un café que te espera.
          </p>

          {/* Location pill */}
          <div className="flex items-center gap-2 text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
            <MapPin className="w-3 h-3" />
            <span>{settings.addressLine} · {settings.localityLine}</span>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-white/30 text-[8px] font-black uppercase tracking-[0.3em]">Explorá</span>
          <ChevronDown className="w-4 h-4 text-white/30" />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* GALLERY — Editorial Masonry                            */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="max-w-[1400px] mx-auto px-5 md:px-10 py-20 md:py-32">
        {/* Section header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 md:mb-16">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">Galería</p>
            <h2 className="text-3xl md:text-5xl font-serif tracking-tight">
              Un Espacio Diseñado
              <br />
              <span className="italic font-light text-stone-400">Para Vos</span>
            </h2>
          </div>
          <p className="text-sm text-stone-500 max-w-sm leading-relaxed font-light">
            Cada rincón fue pensado para que tu experiencia sea tan especial como los anteojos que elegís.
          </p>
        </div>

        {/* Masonry Grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 md:gap-5 space-y-4 md:space-y-5">
          {GALLERY_IMAGES.map((img, i) => (
            <motion.div
              key={img.src}
              className={`relative overflow-hidden rounded-2xl bg-stone-200 break-inside-avoid group cursor-pointer ${img.aspect}`}
              onMouseEnter={() => setHoveredImage(i)}
              onMouseLeave={() => setHoveredImage(null)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              {/* Hover overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent transition-opacity duration-500 ${hoveredImage === i ? 'opacity-100' : 'opacity-0'}`} />
              <div className={`absolute bottom-0 left-0 right-0 p-5 md:p-6 transition-all duration-500 ${hoveredImage === i ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">{String(i + 1).padStart(2, '0')}</p>
                <p className="text-lg font-serif text-white">{img.caption}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PHILOSOPHY — Split Screen                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#1a1714] text-white">
        <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
          {/* Text side */}
          <div className="flex flex-col justify-center px-8 md:px-16 lg:px-20 py-16 lg:py-24 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c8a55c] mb-6">Nuestra Filosofía</p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif tracking-tight leading-tight mb-8">
                Tus anteojos son
                <br />
                <span className="italic font-light text-white/60">el accesorio más</span>
                <br />
                importante que usás.
              </h2>
              <div className="space-y-5 text-white/60 text-base leading-relaxed font-light max-w-lg">
                <p>
                  En <strong className="text-white font-medium">Atelier Óptica</strong> fusionamos la precisión técnica de la salud visual con las últimas tendencias del diseño mundial. Ubicados en el corazón del <strong className="text-white font-medium">Cerro de las Rosas en Córdoba</strong>, entendemos que elegir anteojos es una decisión que impacta cómo te ves y cómo te sentís todos los días.
                </p>
                <p>
                  Nos especializamos en brindar un <strong className="text-white font-medium">asesoramiento personalizado (visagismo)</strong> para encontrar el armazón perfecto según la fisionomía de tu rostro y tu estilo personal. Trabajamos con marcas exclusivas y somos expertos en la adaptación de <strong className="text-white font-medium">cristales multifocales</strong> de última tecnología.
                </p>
              </div>

              {/* Decorative line */}
              <div className="flex items-center gap-4 mt-10">
                <div className="h-[1px] w-12 bg-[#c8a55c]" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#c8a55c]">Desde 2018</span>
              </div>
            </motion.div>
          </div>

          {/* Image side */}
          <motion.div
            className="relative min-h-[400px] lg:min-h-full order-1 lg:order-2 overflow-hidden"
            initial={{ opacity: 0, scale: 1.05 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <Image
              src="/images/blog/mostrador-marmol.webp"
              alt="Mostrador de mármol de Atelier Óptica"
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#1a1714]/30 hidden lg:block" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SERVICES — Glassmorphism Cards                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-[#faf8f5]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-[#c8a55c]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-stone-300/10 blur-[100px]" />

        <div className="relative max-w-[1200px] mx-auto px-5 md:px-10">
          {/* Section header */}
          <div className="text-center mb-14 md:mb-20">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">Lo Que Nos Hace Diferentes</p>
            <h2 className="text-3xl md:text-5xl font-serif tracking-tight">
              Tres Pilares
            </h2>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.title}
                className="group relative bg-white/70 backdrop-blur-xl border border-stone-200/60 rounded-3xl p-8 md:p-10 hover:bg-white hover:shadow-2xl hover:shadow-stone-200/50 transition-all duration-500 hover:-translate-y-2"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
              >
                {/* Number */}
                <span className="text-[80px] font-serif text-stone-100 group-hover:text-stone-200/80 absolute top-4 right-6 leading-none transition-colors duration-500 select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>

                {/* Icon */}
                <div className="w-12 h-12 rounded-2xl bg-[#1a1714] flex items-center justify-center mb-6 group-hover:bg-[#c8a55c] transition-colors duration-500">
                  <service.icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>

                {/* Text */}
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#c8a55c] mb-2">{service.subtitle}</p>
                <h3 className="text-xl font-serif tracking-tight mb-4">{service.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed font-light">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* GOOGLE REVIEWS                                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="max-w-[1200px] mx-auto px-5 md:px-10 pb-20 md:pb-32">
        <div className="text-center mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-3">Lo Que Dicen Nuestros Clientes</p>
          <h2 className="text-3xl md:text-5xl font-serif tracking-tight">
            Opiniones <span className="italic font-light text-stone-400">Reales</span>
          </h2>
        </div>
        <div className="rounded-3xl overflow-hidden border border-stone-200/60 bg-white/50 backdrop-blur-sm shadow-sm">
          <GoogleReviews />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* VISIT US — Premium Info + Map                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#1a1714] text-white py-20 md:py-32">
        <div className="max-w-[1200px] mx-auto px-5 md:px-10">
          {/* Section header */}
          <div className="text-center mb-14 md:mb-20">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c8a55c] mb-3">Te Esperamos</p>
            <h2 className="text-3xl md:text-5xl font-serif tracking-tight">
              Visitanos
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            {/* Info */}
            <div>
              <div className="space-y-8 mb-12">
                {/* Address */}
                <div className="flex gap-5 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#c8a55c]/20 group-hover:border-[#c8a55c]/30 transition-all duration-300">
                    <MapPin className="w-5 h-5 text-[#c8a55c]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1.5">Dirección</p>
                    <p className="text-base font-medium text-white/90">{settings.addressLine}</p>
                    <p className="text-sm text-white/50">{settings.localityLine}</p>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex gap-5 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#c8a55c]/20 group-hover:border-[#c8a55c]/30 transition-all duration-300">
                    <Clock className="w-5 h-5 text-[#c8a55c]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Horarios</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-0.5">Lun – Vie</p>
                        <p className="text-sm font-medium text-white/80">9:00 – 13:30</p>
                        <p className="text-sm font-medium text-white/80">16:00 – 19:30</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-0.5">Sábados</p>
                        <p className="text-sm font-medium text-white/80">10:00 – 14:00</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-5 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#c8a55c]/20 group-hover:border-[#c8a55c]/30 transition-all duration-300">
                    <Phone className="w-5 h-5 text-[#c8a55c]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mb-1.5">Contacto</p>
                    <p className="text-base font-medium text-white/90">{settings.phone}</p>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`https://wa.me/${settings.whatsappPhoneId}?text=Hola%20Atelier%2C%20quiero%20hacer%20una%20consulta`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 justify-center px-7 py-4 bg-[#c8a55c] text-[#1a1714] text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-[#d4b46a] hover:scale-105 transition-all duration-300 shadow-lg shadow-[#c8a55c]/20"
                >
                  <WhatsAppIcon className="w-4 h-4" /> Escribinos
                </a>
                <a
                  href={settings.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 justify-center px-7 py-4 border border-white/20 text-white text-[11px] font-black uppercase tracking-widest rounded-full hover:border-white/50 hover:bg-white/5 transition-all duration-300"
                >
                  <MapPin className="w-4 h-4" /> Cómo Llegar
                </a>
              </div>
            </div>

            {/* Map */}
            <div className="w-full overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ height: 460 }}>
              <iframe
                src="https://maps.google.com/maps?q=Atelier+Optica+Jose+Luis+de+Tejeda+4380+Cordoba&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Atelier Óptica - Ubicación en Cerro de las Rosas, Córdoba"
              />
            </div>
          </div>
        </div>
      </section>

      {children}
      
    </div>
  );
}
