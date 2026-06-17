"use client";

import Link from "next/link";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { useState, useEffect } from "react";

export function StorefrontFooter() {
  const [webSettings, setWebSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setWebSettings(data);
      })
      .catch(err => console.error("Error loading web settings for footer:", err));
  }, []);

  const addressLine = webSettings?.web_store_address || "José Luis de Tejeda 4380";
  const localityLine = webSettings?.web_store_locality || "Cerro de las Rosas, Córdoba";
  const mapsUrl = webSettings?.web_store_maps_url || "https://www.google.com/maps/search/?api=1&query=Atelier+Optica+Cordoba+Jose+Luis+de+Tejeda+4380";
  const whatsappPhoneId = webSettings?.web_store_whatsapp_id || WHATSAPP_PHONE;

  return (
    <footer className="w-full relative z-10 overflow-hidden">
      
      {/* Cinematic Background Image */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/footer-hands-compressed.jpg" 
          alt="Atelier Creation" 
          fill 
          sizes="(max-width: 768px) 100vw, 1200px"
          quality={60}
          loading="lazy"
          className="object-cover object-center"
        />
      </div>

      {/* Footer Content Overlay (Frosted Dark Glass effect) */}
      <div className="relative z-10 w-full h-full bg-stone-950/90 backdrop-blur-3xl border-t border-white/10 text-stone-300">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 px-5 py-12">
          
          {/* Links principales */}
          <div className="flex flex-col gap-1 md:gap-3">
            <p className="text-[10px] md:text-[11px] uppercase tracking-widest font-black text-stone-400 mb-2">Atelier</p>
            <Link href="/contacto" className="text-[13px] md:text-[14px] font-medium text-stone-200 hover:text-white transition-colors py-2 md:py-0">Contacto</Link>
            <Link href="/faq" className="text-[13px] md:text-[14px] font-medium text-stone-200 hover:text-white transition-colors py-2 md:py-0">Atención al Cliente</Link>
            <Link href="/nuestro-local" className="text-[13px] md:text-[14px] font-medium text-stone-200 hover:text-white transition-colors py-2 md:py-0">Nuestro Local</Link>
            <Link href="/resenas" className="text-[13px] md:text-[14px] font-medium text-stone-200 hover:text-white transition-colors py-2 md:py-0">Opiniones de Clientes</Link>
            <Link href="/blog" className="text-[13px] md:text-[14px] font-medium text-stone-200 hover:text-white transition-colors py-2 md:py-0">Editorial</Link>
          </div>

          {/* Ubicación */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] md:text-[11px] uppercase tracking-widest font-black text-stone-400 mb-2">Visitanos</p>
            <p className="text-[13px] md:text-[14px] font-medium leading-relaxed text-stone-100">
              {addressLine}<br />
              {localityLine}
            </p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] text-amber-500/90 font-bold hover:text-amber-400 transition-colors underline decoration-amber-500/30 underline-offset-4 mt-1">
              Ver en Google Maps
            </a>
          </div>

          {/* Políticas Legales */}
          <div className="flex flex-col gap-1 md:gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Legales</p>
            <Link href="/politicas-de-cambio" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">Cambios y Devoluciones</Link>
            <Link href="/terminos-y-condiciones" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">Términos y Condiciones</Link>
            <Link href="/politicas-de-privacidad" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">Políticas de Privacidad</Link>
          </div>

          {/* Redes sociales */}
          <div className="flex flex-col gap-1 md:gap-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400 mb-2">Social</p>
            <a href="https://instagram.com/atelieroptica_" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">Instagram</a>
            <a href="https://www.youtube.com/@atelieroptica" target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">YouTube</a>
            <a href={`https://wa.me/${whatsappPhoneId}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium hover:opacity-60 transition-opacity py-2 md:py-0">WhatsApp</a>
          </div>
          
        </div>

        {/* Info extra (Pagos y AFIP) */}
        <div className="border-t border-white/10 px-5 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-1.5 opacity-50 grayscale hover:grayscale-0 transition-all">
              <svg className="w-8 h-5" viewBox="0 0 38 24" fill="none"><rect width="38" height="24" rx="4" fill="#222"/><path d="M12.062 15.938L15.344 6H17.813L14.531 15.938H12.062ZM24.625 6H26.375C27.063 6 27.656 6.438 27.844 7.094L31.313 15.938H28.719L28.188 14.438H25.031L24.719 15.938H22.375L24.625 6ZM26.719 9.875L25.563 12.875H27.563L26.719 9.875ZM20.406 6.188C19.063 6.188 17.875 6.813 17.875 8.125C17.875 10.438 21.094 10.563 21.094 11.625C21.094 12.188 20.5 12.625 19.5 12.625C18.406 12.625 17.656 12 17.063 11.5L16.594 13.563C17.188 14.125 18.281 14.5 19.5 14.5C21.031 14.5 22.344 13.688 22.344 12.188C22.344 9.688 19.094 9.563 19.094 8.625C19.094 8.125 19.656 7.75 20.5 7.75C21.344 7.75 21.906 8.063 22.344 8.438L22.781 6.438C22.188 6.063 21.281 5.813 20.406 5.813V6.188ZM11.188 6H8.25L7.906 7.625C8.938 7.938 9.969 8.5 10.594 9.313L9.031 15.938H11.5L13.156 6H11.188Z" fill="white"/></svg>
              <svg className="w-8 h-5" viewBox="0 0 38 24" fill="none"><rect width="38" height="24" rx="4" fill="#222"/><circle cx="15.5" cy="12" r="6" fill="#EB001B"/><circle cx="22.5" cy="12" r="6" fill="#F79E1B"/><path d="M19 16.9C17.6 15.8 16.7 14 16.7 12C16.7 10 17.6 8.2 19 7.1C20.4 8.2 21.3 10 21.3 12C21.3 14 20.4 15.8 19 16.9Z" fill="#FF5F00"/></svg>
              <svg className="w-8 h-5" viewBox="0 0 38 24" fill="none"><rect width="38" height="24" rx="4" fill="#005B94"/><path d="M13.2 14.5C14.7 14.5 15.6 13.9 16.2 13.1L14.7 11.9C14.4 12.3 14 12.6 13.3 12.6C12.1 12.6 11.2 11.7 11.2 10.5C11.2 9.3 12.1 8.4 13.3 8.4C14 8.4 14.4 8.7 14.7 9.1L16.2 7.9C15.6 7.1 14.7 6.5 13.2 6.5C10.9 6.5 9 8.3 9 10.5C9 12.7 10.9 14.5 13.2 14.5ZM21.9 6.6L20 14.4H22L22.4 12.8H24.8L25.1 14.4H27.1L24 6.6H21.9ZM23 10.3L23.6 11.4H24.6L24.1 8.8L23 10.3ZM28.9 6.6V14.4H30.8V11.5C31.5 11.8 32.2 11.9 33 11.9C35.2 11.9 36.8 10.4 36.8 8.5C36.8 6.6 35.2 5.1 33 5.1C31.5 5.1 30.1 5.6 28.9 6.6ZM30.8 7.3C31.4 6.9 32.2 6.7 32.9 6.7C34 6.7 34.8 7.5 34.8 8.5C34.8 9.5 34 10.3 32.9 10.3C32.1 10.3 31.4 10.1 30.8 9.7V7.3Z" fill="white"/></svg>
            </div>
            <span className="w-1 h-1 rounded-full bg-stone-300"></span>
            <span className="text-[11px] text-stone-400 font-medium">Envíos Asegurados a todo el país</span>
          </div>
          <p className="text-[11px] text-stone-400">Comprobante AFIP Data Fiscal</p>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 px-5 py-6">
          <p className="text-[12px] text-stone-500 font-medium">© 2026 ATELIER ÓPTICA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
