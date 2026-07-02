"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { ChevronDown, Star, Diamond, Glasses, ShieldCheck, X, Eye, Layers } from "lucide-react";

interface PromoClientProps {
  reviewCount?: number;
}

export function PromoClient({ reviewCount = 642 }: PromoClientProps) {
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  
  // WhatsApp State
  const [isRedirecting, setIsRedirecting] = useState(false);
  const waNumber = "5493541215971";
  const waMessage = "Hola! Vi la Promo 2x1 en la web y quiero recibir asesoramiento.";
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

  // Exit Intent State
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Exit Intent Logic
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasSeenPopup) {
        setShowExitPopup(true);
        setHasSeenPopup(true);
      }
    };
    
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [hasSeenPopup]);

  if (!mounted) return null;

  const handleWhatsAppClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.preventDefault();
    if (isRedirecting) return;
    setIsRedirecting(true);
    setTimeout(() => {
      window.open(waUrl, "_blank", "noopener,noreferrer");
      setIsRedirecting(false);
    }, 800);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "¿Qué es un cristal multifocal y para quién se recomienda?",
      answer: "Los multifocales integran tres zonas de visión (lejos, intermedia y cerca) en un solo cristal sin líneas visibles. Ideales para presbicia."
    },
    {
      question: "¿Cuánto tiempo lleva adaptarse a los multifocales?",
      answer: "Varía según cada persona, usualmente de unos días a un par de semanas. Además, nuestros cristales Varilux cuentan con garantía de adaptación."
    },
    {
      question: "¿Qué tratamientos adicionales puedo agregar?",
      answer: "Podés sumar Antirreflex (reduce reflejos), Filtro Azul (protege de pantallas) y Fotocromáticos Transitions (se oscurecen al sol)."
    },
    {
      question: "¿Tengo mucha graduación, quedarán gruesos?",
      answer: "Trabajamos con cristales de alto índice (súper delgados) que reducen el espesor significativamente. Te asesoramos para elegir el armazón ideal."
    }
  ];

  const reviews = [
    { name: "María G.", text: "Excelente atención y los anteojos me quedaron perfectos. Muy rápidos.", initial: "M" },
    { name: "Carlos S.", text: "Me hice los multifocales con la promo 2x1. Calidad superior, 100% recomendados.", initial: "C" },
    { name: "Lucía P.", text: "Hermosos diseños. La chica de WhatsApp me asesoró bárbaro con mi receta.", initial: "L" }
  ];

  // Framer Motion Variants
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };
  const itemVars: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFC] font-sans selection:bg-[#C5A059] selection:text-white pb-24">
      
      {/* Header Minimalista (Anti-Fugas) */}
      <header className="w-full bg-[#0F0F0F] border-b border-white/10 py-5 px-6 flex justify-center sticky top-0 z-40">
        <div className="text-xl font-serif text-[#C5A059] tracking-[0.2em] uppercase">
          Atelier
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full bg-[#0F0F0F] pt-20 pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           <Image src="/img/store-inside-1.jpg" alt="Atelier Interior" fill sizes="100vw" className="object-cover grayscale" priority />
           <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/80 to-transparent" />
        </div>
        
        <motion.div 
          className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center"
          variants={containerVars}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVars} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold tracking-widest uppercase mb-8">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
            Oferta por Tiempo Limitado
          </motion.div>
          
          <motion.h1 variants={itemVars} className="text-5xl md:text-7xl font-serif text-white leading-tight mb-6">
            Tu Visión x2: <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C5A059] to-[#D4AF37]">
              El Segundo Par de Regalo
            </span>
          </motion.h1>
          
          <motion.p variants={itemVars} className="text-lg md:text-xl text-gray-400 font-light mb-10 max-w-2xl leading-relaxed">
            Transformá tu manera de ver el mundo. Llevate <strong className="text-white font-medium">dos anteojos completos</strong> con cristales premium y pagá solo uno. Envíos a todo el país.
          </motion.p>
          
          <motion.button 
            variants={itemVars}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleWhatsAppClick}
            className="group relative px-8 py-5 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-base uppercase tracking-widest transition-all shadow-[0_0_40px_rgba(197,160,89,0.3)] w-full sm:w-auto"
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
              "Cotizar mi Receta Ahora"
            )}
          </motion.button>
          
          <motion.p variants={itemVars} className="mt-6 text-[#C5A059]/70 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Presupuestos en el acto sin compromiso
          </motion.p>
        </motion.div>
      </section>

      {/* Beneficios (Lucide Icons + Minimalismo) */}
      <section className="py-24 px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] mb-4">¿Por qué esta Promo es tu mejor inversión?</h2>
            <p className="text-gray-500 text-base">La máxima tecnología óptica y diseño de autor a tu alcance.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <motion.div whileHover={{ y: -5 }} className="flex flex-col items-center text-center p-8 bg-[#FCFCFC] border border-gray-100 shadow-sm rounded-2xl">
              <div className="w-16 h-16 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 flex items-center justify-center mb-6 text-[#C5A059]">
                <Diamond className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold mb-3 uppercase tracking-wider text-[#0F0F0F]">Calidad Visual Superior</h3>
              <p className="text-gray-600 text-base leading-relaxed">
                Dos pares de cristales de laboratorio de primera línea al precio de uno. Visión 100% nítida.
              </p>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} className="flex flex-col items-center text-center p-8 bg-[#FCFCFC] border border-gray-100 shadow-sm rounded-2xl">
              <div className="w-16 h-16 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 flex items-center justify-center mb-6 text-[#C5A059]">
                <Glasses className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold mb-3 uppercase tracking-wider text-[#0F0F0F]">El Doble de Estilo</h3>
              <p className="text-gray-600 text-base leading-relaxed">
                Combiná dos estilos diferentes para tu día a día, o convertí tu regalo en anteojos de sol graduados.
              </p>
            </motion.div>

            <motion.div whileHover={{ y: -5 }} className="flex flex-col items-center text-center p-8 bg-[#FCFCFC] border border-gray-100 shadow-sm rounded-2xl">
              <div className="w-16 h-16 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 flex items-center justify-center mb-6 text-[#C5A059]">
                <ShieldCheck className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold mb-3 uppercase tracking-wider text-[#0F0F0F]">Inversión Garantizada</h3>
              <p className="text-gray-600 text-base leading-relaxed">
                Respaldamos ambos pares con Garantía de Adaptación total. Si no te adaptás, cambiamos los cristales gratis.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Explicación de Multifocales (Educación del Cliente) */}
      <section className="py-24 px-6 bg-[#0F0F0F] text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold tracking-widest uppercase mb-6">
              Tecnología Francesa
            </div>
            <h2 className="text-3xl md:text-5xl font-serif mb-6 leading-tight">
              ¿Por qué elegir nuestros <br/><span className="text-[#C5A059]">Cristales Multifocales?</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed font-light">
              Un lente multifocal (o progresivo) elimina la necesidad de cambiar de anteojos constantemente. Gracias a su tallado digital, integra tres campos de visión en una transición invisible y perfecta.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#C5A059] shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Visión de Lejos (Superior)</h4>
                  <p className="text-gray-400 text-sm">Ideal para manejar, caminar o ver paisajes sin distorsión periférica.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#C5A059] shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Visión Intermedia (Centro)</h4>
                  <p className="text-gray-400 text-sm">La transición suave, perfecta para la computadora o el tablero del auto.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#C5A059] shrink-0">
                  <Glasses className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Visión de Cerca (Inferior)</h4>
                  <p className="text-gray-400 text-sm">Enfoque ultra nítido para leer el celular, libros o menú del restaurante.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative h-[500px] w-full rounded-3xl overflow-hidden border border-white/10">
             <Image 
                src="/img/store-inside-1.jpg" 
                alt="Tecnología Multifocal" 
                fill 
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover opacity-50" 
             />
             <div className="absolute inset-0 bg-gradient-to-tr from-[#0F0F0F] via-transparent to-transparent" />
             
             {/* Indicadores Visuales sobre la imagen simulando un lente */}
             <div className="absolute inset-y-10 inset-x-20 border-2 border-dashed border-[#C5A059]/40 rounded-full flex flex-col justify-between py-12 items-center">
                <span className="bg-[#0F0F0F] text-[#C5A059] text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-full border border-[#C5A059]/50">Lejos</span>
                <span className="bg-[#0F0F0F] text-[#C5A059] text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-full border border-[#C5A059]/50">Intermedia</span>
                <span className="bg-[#0F0F0F] text-[#C5A059] text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-full border border-[#C5A059]/50">Cerca</span>
             </div>
          </div>
        </div>
      </section>

      {/* Catálogo Exclusivo (Imágenes de Armazones) */}
      <section className="py-24 px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] mb-4">Algunos de nuestros modelos</h2>
            <p className="text-gray-500 text-base">Elegí tu estilo entre cientos de armazones importados de diseño exclusivo.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { src: "/img/promo/TL3684-c4.avif", title: "TL3684 Carey", desc: "Acetato Premium" },
              { src: "/img/promo/TL3684-c5.avif", title: "TL3684 Transparente", desc: "Acetato Premium" },
              { src: "/img/promo/TL5217-c2.avif", title: "TL5217 Black", desc: "Metal y Acetato" },
              { src: "/img/promo/TL5217-c5.avif", title: "TL5217 Rose Gold", desc: "Metal y Acetato" }
            ].map((glass, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -10 }}
                className="group relative bg-[#FCFCFC] border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
              >
                <div className="relative h-60 w-full bg-white p-4">
                  <Image 
                    src={glass.src} 
                    alt={glass.title} 
                    fill 
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-contain p-6 group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
                <div className="p-6 border-t border-gray-100 bg-[#FCFCFC]">
                  <h4 className="text-lg font-bold text-[#0F0F0F]">{glass.title}</h4>
                  <p className="text-sm text-gray-500 uppercase tracking-wider">{glass.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
             <p className="text-gray-500 italic mb-6">Y muchos modelos más en nuestro salón...</p>
             <button 
                onClick={handleWhatsAppClick}
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-[#0F0F0F] text-[#0F0F0F] hover:bg-[#0F0F0F] hover:text-white font-bold text-sm uppercase tracking-widest transition-colors"
             >
                Pedir catálogo completo por WhatsApp
             </button>
          </div>
        </div>
      </section>

      {/* Social Proof (Reviews) */}
      <section className="py-24 px-6 bg-[#0F0F0F]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-6">Confianza Absoluta</h2>
            <a href="https://maps.app.goo.gl/fQ9T1xBFmDV8Tpim9" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#C5A059] border-b border-[#C5A059] pb-1 hover:text-white hover:border-white transition-colors text-sm font-bold uppercase tracking-widest">
              Ver las {reviewCount} reseñas en Google
            </a>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((rev, i) => (
              <div key={i} className="bg-[#1A1A1A] p-8 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#C5A059]/20 text-[#C5A059] flex items-center justify-center font-serif text-xl">
                    {rev.initial}
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-base">{rev.name}</h4>
                    <div className="flex text-[#C5A059] mt-1">
                      {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-current" />)}
                    </div>
                  </div>
                </div>
                <p className="text-gray-400 text-base leading-relaxed italic">&quot;{rev.text}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif text-[#0F0F0F] text-center mb-12">Preguntas Frecuentes</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden bg-[#FCFCFC]">
                <button
                  onClick={() => toggleFaq(i)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]"
                  aria-expanded={openFaq === i}
                >
                  <span className={`text-base font-bold transition-colors ${openFaq === i ? 'text-[#C5A059]' : 'text-[#0F0F0F]'}`}>
                    {faq.question}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-[#C5A059]' : ''}`} />
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-gray-600 text-base leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-6 bg-[#0F0F0F] text-center border-t border-white/10">
        <h2 className="text-4xl md:text-5xl font-serif text-white mb-8">No te quedes sin tus anteojos</h2>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleWhatsAppClick}
          className="px-10 py-5 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold text-base uppercase tracking-widest transition-colors w-full sm:w-auto shadow-[0_0_30px_rgba(197,160,89,0.3)]"
        >
          {isRedirecting ? "Conectando..." : "Quiero mi 2x1 Ahora"}
        </motion.button>
      </section>

      {/* Footer Minimalista */}
      <footer className="w-full bg-[#FCFCFC] py-12 px-6 border-t border-gray-200 text-center">
        <p className="text-gray-400 text-sm">© 2026 ATELIER ÓPTICA. Cerro de las Rosas, Córdoba.</p>
      </footer>

      {/* WhatsApp Flotante (Con Transición Suave) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleWhatsAppClick}
          className="relative group p-4 bg-[#0F0F0F] border border-[#C5A059]/30 rounded-full shadow-2xl hover:scale-110 hover:border-[#C5A059] transition-all duration-300 flex items-center justify-center"
          aria-label="Contactar por WhatsApp"
        >
          {!isRedirecting && (
             <div className="absolute inset-0 rounded-full border border-[#C5A059] opacity-50 animate-ping group-hover:animate-none" />
          )}
          {isRedirecting ? (
             <svg className="animate-spin h-7 w-7 text-[#C5A059]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
             </svg>
          ) : (
             <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current text-[#C5A059]" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
             </svg>
          )}
        </button>
      </div>

      {/* Exit Intent Popup */}
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
              <button onClick={() => setShowExitPopup(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="w-16 h-16 mx-auto bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-full flex items-center justify-center mb-6 text-[#C5A059]">
                <Diamond className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-serif text-white mb-4">¡Esperá! No te vayas sin tu regalo.</h2>
              <p className="text-gray-400 text-base mb-8">
                Te damos <strong className="text-white">envío gratis a todo el país</strong> además del 2x1 si cotizás tu receta hoy.
              </p>
              <button 
                onClick={(e) => { setShowExitPopup(false); handleWhatsAppClick(e); }}
                className="w-full py-4 bg-[#C5A059] hover:bg-[#b58f4c] text-[#0F0F0F] font-bold uppercase tracking-widest text-sm transition-colors"
              >
                Reclamar Promoción por WhatsApp
              </button>
              <button onClick={() => setShowExitPopup(false)} className="mt-4 text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wider underline underline-offset-4">
                No gracias, prefiero pagar el envío
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
