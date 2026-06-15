"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Check, ChevronDown, MapPin, Star } from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";

export default function PromoLandingPage() {
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent("Hola! Vi la Promo 2x1 en la web y quiero recibir asesoramiento.")}`;

  const faqs = [
    {
      q: "¿La promoción es válida para cualquier armazón?",
      a: "Sí. Podés elegir el primer armazón de cualquier marca y el segundo de regalo será de nuestra línea de marcas seleccionadas de primera calidad."
    },
    {
      q: "¿Pueden ser recetas diferentes?",
      a: "¡Claro que sí! La promoción es ideal para compartirla con un familiar o amigo, sin importar si tienen graduaciones distintas."
    },
    {
      q: "¿La promo 2x1 aplica a lentes multifocales?",
      a: "Sí, abonando tu primer par de multifocales, te llevás de regalo el segundo par de multifocales (con la misma graduación), ideal para tener un par de lectura o sol."
    },
    {
      q: "¿Qué medios de pago aceptan?",
      a: "Aceptamos todas las tarjetas de crédito (hasta 6 cuotas sin interés en el local) y también ofrecemos un 15% de descuento pagando en efectivo o por transferencia bancaria."
    }
  ];

  return (
    <div className="bg-[#faf8f5] min-h-screen text-stone-900 font-sans selection:bg-stone-900 selection:text-white">
      {/* 1. MINIMALIST HEADER */}
      <header className="w-full bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-center">
          <Image 
            src="https://promo.atelieroptica.com.ar/img/logo.svg" 
            alt="Atelier Óptica" 
            width={180} 
            height={40} 
            className="object-contain"
            priority
          />
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative w-full h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="https://promo.atelieroptica.com.ar/img/slider/desktop/01.jpg" 
            alt="Promo 2x1 Atelier" 
            fill 
            className="object-cover object-center"
            priority
          />
          {/* Elegant Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#faf8f5]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white mt-12">
          <span className="inline-block py-1.5 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold tracking-[0.2em] uppercase mb-6 shadow-xl">
            Edición Limitada
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 drop-shadow-lg leading-tight">
            PROMO 2x1 <br className="hidden md:block" />
            <span className="font-light italic text-stone-200">en Anteojos Recetados</span>
          </h1>
          <p className="text-lg md:text-2xl font-light text-stone-200 mb-10 max-w-2xl mx-auto drop-shadow-md">
            Llevate 2 anteojos completos (Armazón + Cristales) y pagá solo uno. Podés combinarlos como quieras o compartirlos.
          </p>
          
          <div className="flex flex-col items-center justify-center space-y-4">
            <a 
              href={WHATSAPP_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="relative inline-flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-5 rounded-full text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)] hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              {/* Pulse Animation Background */}
              <span className="absolute inset-0 w-full h-full bg-white/20 group-hover:animate-ping opacity-0 group-hover:opacity-100 rounded-full"></span>
              <MessageCircle className="w-5 h-5" />
              Escribinos por WhatsApp
            </a>
            <p className="text-xs text-stone-300 uppercase tracking-widest font-bold drop-shadow-md mt-4">
              Presupuestos en el acto sin compromiso
            </p>
          </div>
        </div>
      </section>

      {/* 3. BENEFICIOS / FEATURES */}
      <section className="py-20 bg-[#faf8f5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">¿Por qué elegir Atelier?</h2>
            <div className="w-12 h-1 bg-stone-900 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6">
                <Check className="w-6 h-6 text-stone-900" />
              </div>
              <h3 className="text-xl font-bold mb-3">Cristales Premium</h3>
              <p className="text-stone-600 leading-relaxed">
                Trabajamos exclusivamente con cristales de laboratorio de primera calidad, asegurando una visión nítida y duradera.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6">
                <Check className="w-6 h-6 text-stone-900" />
              </div>
              <h3 className="text-xl font-bold mb-3">Armazones de Diseño</h3>
              <p className="text-stone-600 leading-relaxed">
                Curaduría exhaustiva de marcas nacionales e internacionales. Diseños exclusivos en acetato, metal y TR90.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-6">
                <Check className="w-6 h-6 text-stone-900" />
              </div>
              <h3 className="text-xl font-bold mb-3">Garantía de Adaptación</h3>
              <p className="text-stone-600 leading-relaxed">
                Tu salud visual es lo más importante. Si no te adaptás a tu receta, cambiamos tus cristales sin cargo.
              </p>
            </div>
          </div>
          
          <div className="mt-16 text-center">
            <a 
              href={WHATSAPP_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
            >
              Consultar Stock y Marcas
            </a>
          </div>
        </div>
      </section>

      {/* 4. SOCIAL PROOF / REVIEWS */}
      <section className="py-20 bg-stone-900 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            ))}
          </div>
          <h2 className="text-3xl md:text-4xl font-black mb-8">Óptica 5 Estrellas en Google</h2>
          <p className="text-stone-400 text-lg md:text-xl italic font-light mb-12">
            "Excelente atención, me asesoraron súper bien para elegir mis lentes. La promo 2x1 me vino bárbaro para tener unos de sol con aumento. Los recomiendo!"
          </p>
          <div className="text-sm font-bold uppercase tracking-widest text-stone-300">
            - Más de 200 reseñas reales de clientes felices.
          </div>
        </div>
      </section>

      {/* 5. FAQs ACCORDION */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Preguntas Frecuentes</h2>
            <div className="w-12 h-1 bg-stone-900 mx-auto rounded-full"></div>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FaqItem key={index} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* 6. LOCATION & FINAL CTA */}
      <section className="py-20 bg-[#faf8f5] border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-stone-100 rounded-full mb-6">
            <MapPin className="w-8 h-8 text-stone-900" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Te esperamos en nuestra Boutique</h2>
          <p className="text-stone-600 mb-8 text-lg">
            Luis José de Tejeda 4380, Cerro de las Rosas, Córdoba.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://maps.app.goo.gl/fQ9T1xBFmDV8Tpim9" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-stone-200 text-stone-900 px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-300 transition-colors"
            >
              Abrir en Google Maps
            </a>
            <a 
              href={WHATSAPP_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex justify-center items-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(37,211,102,0.3)] hover:shadow-[0_0_25px_rgba(37,211,102,0.5)] transition-all"
            >
              Agendar Visita
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER MINIMALISTA */}
      <footer className="py-8 bg-white border-t border-stone-200 text-center">
        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
          © 2026 Atelier Óptica. Todos los derechos reservados.
        </p>
      </footer>

      {/* STICKY WHATSAPP BUTTON */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[999] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 group flex items-center justify-center"
      >
        <span className="absolute inset-0 w-full h-full bg-[#25D366] rounded-full animate-ping opacity-75"></span>
        <MessageCircle className="w-8 h-8 relative z-10" />
      </a>
    </div>
  );
}

// Simple FAQ Item Component for the Accordion
function FaqItem({ q, a }: { q: string, a: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-[#faf8f5]">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
      >
        <span className="font-bold pr-4">{q}</span>
        <ChevronDown className={\`w-5 h-5 text-stone-400 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>
      <div 
        className={\`transition-all duration-300 ease-in-out overflow-hidden \${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}\`}
      >
        <div className="px-6 pb-5 pt-0 text-stone-600 leading-relaxed border-t border-stone-100 mt-2">
          {a}
        </div>
      </div>
    </div>
  );
}
