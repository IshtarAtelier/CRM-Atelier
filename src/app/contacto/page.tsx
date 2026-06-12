"use client";

import { useState, useEffect } from "react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { WHATSAPP_PHONE } from "@/lib/constants";

export default function ContactoPage() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error("Error loading settings in contacto page:", err));
  }, []);

  const whatsappPhoneId = settings ? settings.web_store_whatsapp_id : WHATSAPP_PHONE;
  const phone = settings ? settings.web_store_phone : "+54 9 354 121 5971";
  const locality = settings ? settings.web_store_locality : "Cerro de las Rosas, Córdoba Capital.";

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      
      <main className="pt-32 pb-24 px-5 max-w-[1000px] mx-auto flex flex-col md:flex-row gap-16 min-h-[70vh]">
        
        {/* Info lateral */}
        <div className="flex-1">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-6" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Contacto
          </h1>
          <p className="text-stone-600 leading-relaxed mb-10">
            Estamos para asesorarte. Escribinos para coordinar un turno de atención personalizada o para resolver dudas sobre nuestros productos.
          </p>

          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">WhatsApp Directo</p>
              <a href={`https://wa.me/${whatsappPhoneId}`} className="text-lg font-medium hover:underline decoration-1 underline-offset-4">{phone}</a>
            </div>
            
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">Instagram</p>
              <a href="https://instagram.com/atelieroptica_" className="text-lg font-medium hover:underline decoration-1 underline-offset-4">@atelieroptica_</a>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">Ubicación</p>
              <p className="text-lg font-medium">{locality}</p>
            </div>
          </div>
        </div>

        {/* Formulario simple */}
        <div className="flex-1 bg-stone-50 p-8 rounded-2xl border border-stone-100">
          <h2 className="text-xl font-medium mb-6">Dejanos tu mensaje</h2>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); alert('Funcionalidad en desarrollo. Por favor, comunícate por WhatsApp.'); }}>
            <div>
              <label className="block text-[12px] font-medium text-stone-500 mb-1">Nombre completo</label>
              <input type="text" className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="Ej: María Pérez" required />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-stone-500 mb-1">Email</label>
              <input type="email" className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" placeholder="maria@ejemplo.com" required />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-stone-500 mb-1">Tu consulta</label>
              <textarea className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black min-h-[120px]" placeholder="¿En qué te podemos ayudar?" required></textarea>
            </div>
            <button type="submit" className="w-full bg-black text-white rounded-lg py-4 text-[12px] font-bold tracking-widest uppercase hover:bg-stone-800 transition-colors">
              Enviar Mensaje
            </button>
          </form>
        </div>

      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
