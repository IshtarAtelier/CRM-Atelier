"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";

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

export default function TiendaPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/store/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

      <main className="max-w-[1600px] mx-auto px-5 py-12 pb-20">

        {loading ? (
          /* ── SKELETON ── */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-stone-100 aspect-square rounded-sm mb-4" />
                <div className="h-3 bg-stone-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14"
            >
              {filtered.map((p) => {
                const imgUrl = p.imagenesCatalogo?.length > 0
                  ? `/api/storage/view?key=${encodeURIComponent(p.imagenesCatalogo[0])}`
                  : null;

                return (
                  <Link
                    key={p.id}
                    href={`/producto/${p.id}`}
                    className="group block"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Imagen */}
                    <div className="bg-[#f5f5f5] aspect-square overflow-hidden mb-4 relative">
                      {imgUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            src={imgUrl}
                            alt={`${p.brand} ${p.model}`}
                            className="w-full h-full object-contain mix-blend-multiply transition-transform duration-700"
                            style={{ transform: hoveredId === p.id ? "scale(1.08)" : "scale(1)" }}
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

                      {/* Badge categoría */}
                      {p.category && (
                        <span className="absolute top-3 left-3 text-[8px] font-black uppercase tracking-widest bg-white/80 backdrop-blur-sm px-2 py-1 z-10">
                          {isXlProduct(p) ? `${p.category} · XL` : p.category}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[12px] font-bold text-stone-900 leading-tight group-hover:text-black transition-colors">
                          {p.brand}
                        </h3>
                        <p className="text-[12px] text-stone-500 leading-tight">{p.model}</p>
                      </div>
                      <p className="text-[12px] font-bold text-stone-900 shrink-0">
                        ${p.price?.toLocaleString("es-AR")}
                      </p>
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
        )}

        {/* Contador */}
        {!loading && filtered.length > 0 && (
          <p className="mt-12 text-center text-[10px] text-stone-300 uppercase tracking-widest font-bold">
            {filtered.length} {filtered.length === 1 ? "modelo" : "modelos"} · Atelier Óptica
          </p>
        )}
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
