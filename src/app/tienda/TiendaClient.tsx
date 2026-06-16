"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { resolveStorageUrl } from "@/lib/utils/storage";

const CATEGORIES = ["Todo", "Receta", "Sol", "XL", "Clip-On", "Contacto"];

const isXlProduct = (p: any) => {
  const nameLower = (p.name || "").toLowerCase();
  const modelLower = (p.model || "").toLowerCase();
  return nameLower.includes("athena") || 
         nameLower.includes("gaia") || 
         nameLower.includes("clio") || 
         nameLower.includes("minerva") || 
         nameLower.includes("artemis") ||
         modelLower.includes("91501") ||
         modelLower.includes("238014") ||
         modelLower.includes("238015") ||
         modelLower.includes("3932") ||
         modelLower.includes("g7013");
};

export function TiendaClient({ 
  initialProducts,
  availableBrands = [],
  availableShapes = [],
  availableMaterials = []
}: { 
  initialProducts: any[];
  availableBrands?: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
}) {
  const [activeCategory, setActiveCategory] = useState("Todo");

  const [webSettings, setWebSettings] = useState({
    web_promo_cash_discount: 15,
    web_promo_installments: "6 cuotas sin interés"
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setWebSettings({
            web_promo_cash_discount: data.web_promo_cash_discount !== undefined ? Number(data.web_promo_cash_discount) : 15,
            web_promo_installments: data.web_promo_installments || "6 cuotas sin interés"
          });
        }
      })
      .catch(err => console.error("Error loading web settings for tienda client:", err));
  }, []);

  const getInstallmentsCount = (text: string) => {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 6;
  };

  const installmentsCount = getInstallmentsCount(webSettings.web_promo_installments);
  const discountRate = webSettings.web_promo_cash_discount / 100;

  // Removed loading state and fetch since products are passed as props
  const products = initialProducts || [];

  const filtered = activeCategory === "Todo"
    ? products
    : products.filter(p => {
        const cat = (p.category || "").toLowerCase();
        const active = activeCategory.toLowerCase();
        
        if (active === "receta") {
          return cat.includes("receta") || cat.includes("armazón") || cat.includes("armazon") || cat.includes("frame");
        }
        if (active === "sol") {
          return cat.includes("sol") || cat.includes("sun");
        }
        if (active === "xl") {
          return isXlProduct(p);
        }
        if (active === "clip-on") {
          return cat.includes("clip");
        }
        if (active === "contacto") {
          return cat.includes("contacto") || cat.includes("contact");
        }
        return cat === active;
      });


  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />

      {/* ── HERO BAR ── */}
      <div className="pt-20 border-b border-stone-100">
        <div className="max-w-[1600px] mx-auto px-5 py-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 mb-2">Atelier Óptica</p>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              Colección
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
            Armazones seleccionados a mano. Cada pieza elegida por diseño, calidad y carácter.
          </p>
        </div>

        {/* ── FILTROS ── */}
        <div className="max-w-[1600px] mx-auto px-5 pb-0 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400 mr-2 shrink-0" />
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 text-[11px] font-bold uppercase tracking-widest px-4 py-3 border-b-2 transition-all duration-200 ${
                activeCategory === cat
                  ? "border-black text-black"
                  : "border-transparent text-stone-400 hover:text-black hover:border-stone-300"
              }`}
            >
              {cat}
            </button>
          ))}
          {activeCategory !== "Todo" && (
            <button
              onClick={() => setActiveCategory("Todo")}
              className="shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold text-stone-400 hover:text-black transition-colors"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── MEDIOS DE PAGO STRIP ── */}
      <PaymentOptions variant="strip" />

      <main className="max-w-[1600px] mx-auto px-5 py-12 pb-20 flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <ProductFilters 
            availableBrands={availableBrands} 
            availableShapes={availableShapes}
            availableMaterials={availableMaterials}
          />
        </aside>

        <div className="flex-1">

        {/* The skeleton is no longer needed since data is preloaded */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14"
            >
              {filtered.map((p, index) => {
                const hasSecondImage = p.imagenesCatalogo && p.imagenesCatalogo.length > 1;
                const imgUrl = p.imagenesCatalogo?.length > 0
                  ? resolveStorageUrl(p.imagenesCatalogo[0])
                  : null;
                const secondImgUrl = hasSecondImage
                  ? resolveStorageUrl(p.imagenesCatalogo[1])
                  : null;

                return (
                  <Link
                    key={p.id}
                    href={`/producto/${p.slug || p.id}`}
                    className="group block"
                  >
                    {/* Imagen */}
                    <div className="bg-[#f5f5f5] aspect-square overflow-hidden mb-4 relative">
                      {/* Badge Urgencia / Escasez */}
                      {p.stock !== undefined && p.stock > 0 && p.stock <= 3 && (
                        <span className="absolute top-3 right-3 z-10 bg-red-650 text-white text-[7.5px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded shadow-md animate-pulse">
                          Últimas {p.stock} u.
                        </span>
                      )}

                      {imgUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image
                            src={imgUrl}
                            alt={`${p.brand} ${p.model}`}
                            fill
                            priority={index < 4}
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                            className={`object-contain mix-blend-multiply transition-opacity duration-500 ease-in-out ${
                              ((p.model || '').toLowerCase().includes('tl3932 c3') || (p.model || '').toLowerCase().includes('diana') || p.id === 'cmq5d11hf002rhy61fhvqs7nj')
                                ? "scale-125"
                                : "scale-100"
                            } ${hasSecondImage ? 'md:group-hover:opacity-0' : ''}`}
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          <span className="text-[9px] uppercase tracking-widest">Sin foto</span>
                        </div>
                      )}

                      {hasSecondImage && secondImgUrl && (
                        <Image
                          src={secondImgUrl}
                          alt={`${p.brand} ${p.model} Try-On`}
                          fill
                          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out"
                        />
                      )}

                      {/* Badge categoría */}
                      {p.category && (
                        <span className="absolute top-3 left-3 text-[8px] font-black uppercase tracking-widest bg-white/80 backdrop-blur-sm px-2 py-1 z-10">
                          {isXlProduct(p) ? `${p.category} · XL` : p.category}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1 mt-4 px-1">
                      <h3 className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.20em] mb-0.5">{p.brand || 'ATELIER'}</h3>
                      <h2 className="text-base font-serif tracking-tight text-stone-900 leading-tight mb-2 group-hover:text-black transition-colors">
                        {p.name || p.model}
                      </h2>
                      
                      <div className="pt-2 border-t border-stone-100/80 dark:border-stone-800/40 flex flex-col gap-1">
                        <div className="flex justify-between items-baseline">
                          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                            {webSettings.web_promo_installments} de <span className="font-extrabold text-[#b08f4c] dark:text-[#c8a55c]">${Math.round((p.price || 0) / installmentsCount).toLocaleString("es-AR")}</span>
                          </p>
                        </div>
                        
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                          ${Math.round((p.price || 0) * (1 - discountRate)).toLocaleString("es-AR")} en efectivo/transf. <span className="text-emerald-600 dark:text-emerald-500 font-bold text-[9px] uppercase tracking-wider">({webSettings.web_promo_cash_discount}% OFF)</span>
                        </p>
                        
                        <p className="text-[9px] text-stone-350 dark:text-stone-600">
                          Precio de lista: ${(p.price || 0).toLocaleString("es-AR")}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {filtered.length === 0 && (
                <div className="col-span-full py-24 text-center">
                  <p className="text-stone-400 text-sm uppercase tracking-widest mb-4">Sin productos en esta categoría</p>
                  <button onClick={() => setActiveCategory("Todo")} className="text-xs font-bold underline">
                    Ver todo
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        {filtered.length > 0 && (
          <p className="mt-12 text-center text-[10px] text-stone-300 uppercase tracking-widest font-bold">
            {filtered.length} {filtered.length === 1 ? "modelo" : "modelos"} · Atelier Óptica
          </p>
        )}
        </div>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp message="¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento personalizado." />
    </div>
  );
}
