"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { WHATSAPP_PHONE } from "@/lib/constants";

export function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if exit intent was already shown in this session
    const hasBeenShown = sessionStorage.getItem("atelier-exit-intent-shown");
    if (hasBeenShown === "true") return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger strictly when the mouse leaves the viewport from the top (clientY <= 0).
      // This ensures it only triggers when aiming for the address bar/tabs, preventing accidental popups.
      if (e.clientY <= 0) {
        const alreadyShown = sessionStorage.getItem("atelier-exit-intent-shown");
        if (!alreadyShown) {
          setIsOpen(true);
          sessionStorage.setItem("atelier-exit-intent-shown", "true");
        }
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const whatsappMessage = encodeURIComponent("Hola Atelier! Estaba viendo su web y me quedé con algunas dudas. ¿Me podrían asesorar?");
  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClose();
              }
            }}
            role="button"
            tabIndex={-1}
            aria-label="Cerrar modal"
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-white dark:bg-stone-950 border border-stone-100 dark:border-stone-900 max-w-md w-full rounded-3xl p-8 shadow-2xl z-10 text-center space-y-6 overflow-hidden"
          >
            {/* Elegant Background Glow */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#b08f4c]/10 rounded-full filter blur-xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 bg-stone-50 dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-850 rounded-full text-stone-400 hover:text-stone-800 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="w-16 h-16 bg-[#faf8f5] dark:bg-stone-900 text-[#b08f4c] rounded-full flex items-center justify-center mx-auto text-2xl">
              🎁
            </div>

            {/* Text */}
            <div className="space-y-2.5">
              <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100 font-light leading-tight">
                ¡Esperá! Tenemos un regalo para vos.
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed font-light">
                Terminá tu compra hoy y llevate <strong>Envío Gratis a todo el país</strong>. Si tenés dudas con tu receta o qué marco elegir, un asesor óptico está disponible ahora mismo por WhatsApp.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClose}
                className="w-full py-4 bg-black text-white hover:bg-stone-800 text-[10px] font-black uppercase tracking-widest rounded-full transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Chatear con Asesor Óptico
              </a>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900 dark:hover:bg-stone-850 text-stone-600 dark:text-stone-400 text-[9px] font-bold uppercase tracking-widest rounded-full transition-colors cursor-pointer"
              >
                Seguir Navegando
              </button>
            </div>

            {/* Footnote */}
            <p className="text-[8.5px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
              Atelier Óptica · Cerro de las Rosas
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
