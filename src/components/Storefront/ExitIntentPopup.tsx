"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, MapPin, Clock } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_PHONE } from "@/lib/constants";

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    // Check if popup was already shown in this session
    const wasShown = sessionStorage.getItem("atelier-exit-intent-shown");
    if (wasShown) return;

    // Wait at least 5 seconds before enabling the detector
    const initTimer = setTimeout(() => {
      const handleMouseLeave = (e: MouseEvent) => {
        // e.clientY < 50 means the mouse went up to exit the window
        if (e.clientY < 50) {
          setIsOpen(true);
          sessionStorage.setItem("atelier-exit-intent-shown", "true");
          // Remove listener once triggered
          document.removeEventListener("mouseleave", handleMouseLeave);
        }
      };

      document.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        document.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, 5000);

    return () => clearTimeout(initTimer);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const whatsappMessage = encodeURIComponent(
    "¡Hola! Estaba por salir de la web y me gustaría recibir asesoramiento para mis anteojos y aprovechar el 15% de descuento por transferencia."
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative bg-white max-w-lg w-full rounded-[2.5rem] border border-[#e8e2db]/40 p-8 md:p-10 shadow-2xl z-10 flex flex-col gap-6 text-center select-none"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-black rounded-full transition-colors font-sans"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Quality Label Sello */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#faf8f5] border border-amber-500/20 text-stone-700 rounded-full text-[9px] font-black uppercase tracking-[0.2em] font-sans">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                ¿Tenés dudas con tu receta o cristales?
              </span>
            </div>

            {/* Title */}
            <div className="space-y-3">
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-stone-900 leading-none">
                ¡Te asesoramos en vivo!
              </h2>
              <p className="text-xs md:text-sm font-sans font-light text-stone-500 leading-relaxed max-w-md mx-auto">
                No te quedes con dudas. Envianos tu receta por WhatsApp y un especialista óptico la analizará sin cargo.
              </p>
            </div>

            {/* Incentive Badge */}
            <div className="py-4 px-6 rounded-2xl bg-[#eefaf4] border border-[#d2f4e1] text-center font-sans">
              <p className="text-[#1c432d] font-bold text-xs uppercase tracking-widest mb-1">💳 Beneficio Exclusivo</p>
              <p className="text-[#2c6e49] text-xs font-light">
                Aprovechá <strong>6 cuotas sin interés</strong> o <strong>15% OFF</strong> en efectivo/transferencia con envío gratis.
              </p>
            </div>

            {/* Local info snippet */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center py-2 border-y border-stone-100 font-sans text-xs text-stone-500">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#b08f4c]" /> Tejeda 4380, Cerro de las Rosas
              </span>
              <span className="hidden sm:inline text-stone-300">|</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#b08f4c]" /> Lun-Vie 9-13:30 · 16-19:30
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 font-sans pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 hover:bg-green-500 text-white py-4 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-full shadow-lg"
              >
                <WhatsAppIcon className="w-4 h-4 fill-white" /> Enviar Receta por WhatsApp
              </a>
              <button
                onClick={handleClose}
                className="w-full text-stone-400 hover:text-black py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Seguir navegando en Atelier
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
