"use client";

import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";

export function FloatingWhatsApp() {
  const [isVisible, setIsVisible] = useState(false);

  // Solo mostrar después de un par de segundos para que no sea intrusivo al cargar la página
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const WHATSAPP_NUMBER = "5493541215971";
  const WHATSAPP_MESSAGE = encodeURIComponent("¡Hola Atelier! Me gustaría hacer una consulta.");
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      
      {/* Tooltip de Invitación tipo Chat Bubble */}
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1, duration: 0.4 }}
        className="relative bg-white px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-stone-100 hidden sm:block pointer-events-auto mr-2"
      >
        <p className="text-[13px] font-bold text-stone-800 tracking-tight mb-0.5">
          ¿Necesitás ayuda? 👋
        </p>
        <p className="text-[11px] font-medium text-stone-500">
          Chateá con nuestros asesores.
        </p>
        {/* El piquito del globo (Tail) */}
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white border-b border-r border-stone-100 transform rotate-45 rounded-sm"></div>
      </motion.div>

      {/* Botón Flotante con animación de pulso */}
      <a 
        href={WHATSAPP_URL} 
        target="_blank" 
        rel="noopener noreferrer"
        className="relative group pointer-events-auto"
        aria-label="Contactar por WhatsApp"
      >
        {/* Anillo exterior que hace pulso */}
        <div className="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-ping group-hover:animate-none" />
        
        {/* Botón principal (con logo oficial SVG de WhatsApp) */}
        <div className="relative bg-gradient-to-tr from-green-600 to-green-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 hover:shadow-green-500/30 transition-all duration-300">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        </div>
      </a>
      
    </div>
  );
}
