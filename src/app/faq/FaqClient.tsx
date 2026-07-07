"use client";

import Link from "next/link";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooterStatic as StorefrontFooter } from "@/components/Storefront/StorefrontFooterStatic";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { FAQ_CATEGORIES } from "@/lib/faq-data";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

export function FaqClient() {
  // Clave "catIdx-itemIdx" del item abierto (uno a la vez). El contenido de
  // los cerrados igual queda montado en el DOM: clave para SEO/GEO.
  const [openKey, setOpenKey] = useState<string | null>("0-0");

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />

      <main className="pt-32 pb-24 px-5 max-w-[820px] mx-auto min-h-[70vh]">
        <header className="mb-12 text-center border-b border-stone-200 pb-8">
          <h1 className="text-3xl md:text-4xl font-normal tracking-tight">Preguntas Frecuentes</h1>
          <p className="text-stone-500 mt-3 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
            Respuestas sobre anteojos recetados, cristales multifocales, obras sociales, medios de
            pago y envíos a todo el país. Somos <strong className="font-medium text-stone-700">Atelier
            Óptica</strong>, óptica en Cerro de las Rosas, Córdoba.
          </p>
        </header>

        <div className="space-y-12">
          {FAQ_CATEGORIES.map((cat, catIdx) => (
            <section key={cat.category} aria-labelledby={`cat-${catIdx}`}>
              <h2
                id={`cat-${catIdx}`}
                className="text-[11px] uppercase tracking-[0.18em] font-semibold text-stone-400 mb-4"
              >
                {cat.category}
              </h2>

              <div className="space-y-3">
                {cat.items.map((faq, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const isOpen = openKey === key;
                  const panelId = `faq-panel-${key}`;
                  const btnId = `faq-btn-${key}`;
                  return (
                    <div
                      key={key}
                      className="border border-stone-200 rounded-lg overflow-hidden"
                    >
                      <h3 className="m-0">
                        <button
                          id={btnId}
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          className="w-full px-6 py-4 flex justify-between items-center gap-4 text-left bg-stone-50 hover:bg-stone-100 transition-colors"
                          onClick={() => setOpenKey(isOpen ? null : key)}
                        >
                          <span className="font-medium text-stone-800 text-[14px] md:text-[15px]">
                            {faq.q}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-stone-500 shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </h3>

                      {/* Panel siempre montado (height animada) para que el texto
                          esté en el HTML aunque esté colapsado. */}
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={btnId}
                        initial={false}
                        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="px-6 py-5 text-sm md:text-[15px] text-stone-600 leading-relaxed bg-white">
                          <p>{faq.a}</p>
                          {faq.links && faq.links.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                              {faq.links.map((l) => (
                                <Link
                                  key={l.href}
                                  href={l.href}
                                  className="text-[13px] font-medium text-[#b08f4c] underline decoration-[#b08f4c]/30 underline-offset-4 hover:decoration-[#b08f4c]"
                                >
                                  {l.label} →
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 text-center border-t border-stone-200 pt-10">
          <p className="text-stone-500 text-sm mb-4">¿Tenés otra duda? Te respondemos personalmente.</p>
          <a
            href={`https://wa.me/${WHATSAPP_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
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
