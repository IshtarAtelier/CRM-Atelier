"use client";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useState, useEffect } from "react";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { usePathname } from "next/navigation";

export function FloatingWhatsApp({ message, productName }: { message?: string; productName?: string } = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  // Solo mostrar después de un par de segundos para que no sea intrusivo al cargar la página
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/login")) {
    return null;
  }

  let defaultText = "Los vi en la nueva web de Atelier, quisiera que me asesoren.";
  
  if (productName) {
    defaultText = `¡Hola! Tengo dudas sobre el modelo ${productName} y me gustaría recibir asesoramiento.`;
  } else if (message) {
    defaultText = message;
  } else if (pathname?.includes("/tienda") || pathname?.includes("/producto/")) {
    defaultText = "¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento.";
  } else if (pathname?.includes("/arma-tus-lentes")) {
    defaultText = "¡Hola Atelier! Me gustaría recibir asesoramiento para armar mis lentes.";
  }

  const WHATSAPP_MESSAGE = encodeURIComponent(defaultText);
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${WHATSAPP_MESSAGE}`;

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      
      {/* Tooltip de Invitación tipo Chat Bubble */}
      <div
        className="wa-tooltip-in relative bg-white px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-100 hidden sm:block pointer-events-auto mr-2"
      >
        <p className="text-[13px] font-bold text-stone-800 tracking-tight mb-0.5">
          ¿Necesitás ayuda? 👋
        </p>
        <p className="text-[11px] font-medium text-stone-500">
          Chateá con nuestros asesores.
        </p>
        {/* El piquito del globo (Tail) */}
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white border-b border-r border-stone-100 transform rotate-45 rounded-sm"></div>
      </div>

      {/* Botón Flotante con animación de pulso */}
      <a 
        href={WHATSAPP_URL} 
        target="_blank" 
        rel="noopener noreferrer"
        className="relative group pointer-events-auto"
        aria-label="Contactar por WhatsApp"
      >
        {/* Anillo exterior que hace pulso */}
        <div className="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-pulse group-hover:animate-none" />
        
        {/* Botón principal (con logo oficial SVG de WhatsApp) */}
        <div className="relative bg-gradient-to-tr from-green-600 to-green-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 hover:shadow-green-500/30 transition-all duration-300">
          <WhatsAppIcon className="w-7 h-7" />
        </div>
      </a>
      
    </div>
  );
}
