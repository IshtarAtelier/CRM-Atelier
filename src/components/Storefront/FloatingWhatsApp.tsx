"use client";

import { motion } from "framer-motion";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useState, useEffect } from "react";
import { buildWhatsAppUrl, currentPageUrl } from "@/lib/whatsapp-link";
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

  // /mayorista/catalogo ya trae su propia barra de CTA con WhatsApp fija abajo
  // (mismo ancho de pantalla): la burbuja flotante quedaba superpuesta arriba.
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/login") || pathname?.startsWith("/mayorista")) {
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

  // En ficha de producto y tienda mandamos también el link de la página: WhatsApp
  // arma la previsualización con la foto, así el asesor ve qué está mirando.
  const sharesPageUrl = Boolean(
    productName || pathname?.includes("/producto/") || pathname?.includes("/tienda")
  );

  const WHATSAPP_URL = buildWhatsAppUrl(defaultText, {
    pageUrl: sharesPageUrl ? currentPageUrl(pathname || "") : undefined,
  });

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
        <div className="absolute inset-0 bg-green-500 rounded-full opacity-30 animate-pulse group-hover:animate-none" />
        
        {/* Botón principal (con logo oficial SVG de WhatsApp) */}
        <div className="relative bg-gradient-to-tr from-green-600 to-green-500 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 hover:shadow-green-500/30 transition-all duration-300">
          <WhatsAppIcon className="w-7 h-7" />
        </div>
      </a>
      
    </div>
  );
}
