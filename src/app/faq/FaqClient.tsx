"use client";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooterStatic as StorefrontFooter } from "@/components/Storefront/StorefrontFooterStatic";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    question: "¿Hacen envíos a todo el país?",
    answer: "Sí, realizamos envíos a toda Argentina a través de Correo Argentino o Andreani. Los envíos superando cierto monto son bonificados."
  },
  {
    question: "¿Trabajan con obras sociales?",
    answer: "Trabajamos con reintegros. Te entregamos la factura oficial y todos los comprobantes necesarios para que puedas presentar el trámite en tu obra social o prepaga."
  },
  {
    question: "¿Tienen garantía los cristales multifocales?",
    answer: "Absolutamente. Todos nuestros cristales multifocales Varilux cuentan con garantía de adaptación. Si no te adaptás en los primeros 30 días, te cambiamos los cristales sin costo (es requisito presentar una nueva receta emitida por tu oftalmólogo, y entre ambas recetas no deben transcurrir más de 90 días)."
  },
  {
    question: "¿Puedo probarme los anteojos antes de comprarlos?",
    answer: "Si estás en Córdoba, te invitamos a nuestro local en Cerro de las Rosas para que te pruebes todo el catálogo. Si estás en otra provincia, podés usar nuestra herramienta de Virtual Try-On en la Tienda."
  }
];

export function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      
      <main className="pt-32 pb-24 px-5 max-w-[800px] mx-auto min-h-[70vh]">
        <div className="mb-12 text-center border-b border-stone-200 pb-8">
          <h1 className="text-3xl font-normal tracking-tight">Preguntas Frecuentes</h1>
          <p className="text-stone-500 mt-2 text-sm">Resolvemos tus dudas principales.</p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="border border-stone-200 rounded-lg overflow-hidden">
                <button 
                  className="w-full px-6 py-4 flex justify-between items-center text-left bg-stone-50 hover:bg-stone-100 transition-colors"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="font-medium text-stone-800 text-[14px]">{faq.question}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-stone-500" /> : <ChevronDown className="w-4 h-4 text-stone-500" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 py-5 text-sm text-stone-600 leading-relaxed bg-white">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-stone-500 text-sm mb-4">¿Tenés otra duda?</p>
          <a 
            href={`https://wa.me/${WHATSAPP_PHONE}`} 
            target="_blank" rel="noopener noreferrer"
            className="inline-block px-8 py-3 bg-black text-white text-[12px] uppercase tracking-widest font-medium hover:opacity-80 transition-opacity rounded-full"
          >
            Hablar por WhatsApp
          </a>
        </div>
      </main>

      <StorefrontFooter />
      
    </div>
  );
}
