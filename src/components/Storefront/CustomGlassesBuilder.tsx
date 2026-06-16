"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LensConfigurator } from "./LensConfigurator";
import dynamic from "next/dynamic";
const Interactive3DImage = dynamic(() => import("./Interactive3DImage").then(mod => mod.Interactive3DImage), { ssr: false });
import Image from "next/image";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";

interface Product {
  id: string;
  brand: string;
  model: string;
  price: number;
  stock: number;
  imagenesCatalogo: string[];
  mockImage?: string;
  category: string;
  slug: string;
}

export function CustomGlassesBuilder({ products }: { products: Product[] }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  const [configuratorStep, setConfiguratorStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Todas");
  
  const { setIsOpen: setCartOpen } = useCart();

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    setConfiguratorStep(1);
    if (window.innerWidth < 1024) {
      setIsMobileConfigOpen(true);
    }
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setConfiguratorStep(1);
  };

  // Compile unique list of brands from actual products list
  const uniqueBrands = ["Todas", ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];

  // Filter products based on search query and selected brand
  const filteredProducts = products.filter(p => {
    const brandStr = p.brand || "";
    const modelStr = p.model || "";
    
    const matchesSearch = 
      brandStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      modelStr.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesBrand = 
      selectedBrand === "Todas" || 
      brandStr.toLowerCase() === selectedBrand.toLowerCase();
      
    return matchesSearch && matchesBrand;
  });

  // Calculate current global step (1 to 3) based on selected product and configurator inner step (1-4)
  const currentGlobalStep = selectedProduct === null 
    ? 1 
    : (configuratorStep === 4 ? 3 : 2);

  const configuratorContent = selectedProduct ? (
    <motion.div 
      key="configurator"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full bg-white/70 backdrop-blur-3xl lg:rounded-[2rem] p-6 lg:p-12 overflow-y-auto shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] relative border border-white/50"
    >
      {/* Mobile close button */}
      <button 
        className="lg:hidden absolute top-6 right-6 z-50 p-3 bg-black/5 backdrop-blur-md rounded-full text-black hover:bg-black/10 transition-colors"
        onClick={() => setIsMobileConfigOpen(false)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>

      {/* Selected Product Header */}
      <div className="flex flex-col items-center text-center mb-12">
        <Interactive3DImage 
          src={(selectedProduct.imagenesCatalogo.length > 0 ? resolveStorageUrl(selectedProduct.imagenesCatalogo[0]) : "") || selectedProduct.mockImage || "/images/placeholder.svg"}
          alt={selectedProduct.model || 'Anteojo'}
          className="w-full max-w-[280px] h-40 mb-6"
          imageClassName={((selectedProduct.model || '').toLowerCase().includes('tl3932 c3') || (selectedProduct.model || '').toLowerCase().includes('diana') || selectedProduct.id === 'cmq5d11hf002rhy61fhvqs7nj') ? 'scale-125' : ''}
        />
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#999] font-bold mb-2">{selectedProduct.brand}</p>
        <h4 className="text-3xl font-serif uppercase tracking-tight leading-none mb-4">{selectedProduct.model}</h4>
        <p className="text-sm font-medium text-black">${selectedProduct.price.toLocaleString()}</p>
      </div>

      <LensConfigurator 
        key={selectedProduct.id}
        basePrice={selectedProduct.price}
        productId={selectedProduct.id}
        productInfo={{ 
          brand: selectedProduct.brand, 
          model: selectedProduct.model, 
          image: (selectedProduct.imagenesCatalogo.length > 0 ? resolveStorageUrl(selectedProduct.imagenesCatalogo[0]) : "") || selectedProduct.mockImage || "/images/placeholder.svg"
        }}
        onStepChange={setConfiguratorStep}
        onSuccess={() => {
          setIsMobileConfigOpen(false);
          setCartOpen(true);
        }}
      />
    </motion.div>
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Chat Bubble 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white border border-stone-200 text-stone-800 p-5 rounded-2xl rounded-tl-sm shadow-sm w-[85%] self-start"
        >
          <p className="text-[13px] font-medium leading-relaxed">
            ¡Hola! 👋 Te voy a guiar paso a paso en el diseño de tus nuevos lentes a medida.
          </p>
        </motion.div>

        {/* Chat Bubble 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 1.5 }}
          className="bg-white border border-stone-200 text-stone-800 p-5 rounded-2xl rounded-tl-sm shadow-sm w-[92%] self-start"
        >
          <p className="text-[13px] font-medium leading-relaxed">
            El primer paso es elegir tu armazón. En el catálogo vas a encontrar nuestras opciones exclusivas en metal y acetato.
          </p>
        </motion.div>

        {/* Chat Bubble 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 2.8 }}
          className="bg-stone-900 text-white p-4 rounded-2xl rounded-br-sm shadow-md w-[80%] self-end mt-4 text-center"
        >
          <p className="text-[12px] font-bold tracking-wide uppercase">
            👉 Seleccioná un modelo para comenzar
          </p>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100dvh-72px)] bg-[#fafafa]">
      
      {/* ── BARRA DE PROCESO (STEPS) ── */}
      <div className="w-full bg-white border-b border-stone-200/50 px-4 py-4 md:py-5 flex justify-center items-center shrink-0">
        <div className="flex items-center justify-between w-full max-w-xl md:max-w-2xl px-2">
          {/* Paso 1: Armazón */}
          <button 
            onClick={handleClearSelection}
            className="flex items-center gap-2 group cursor-pointer focus:focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter border transition-all duration-300 ${
              currentGlobalStep === 1 
                ? 'bg-black border-black text-white scale-110 shadow-md shadow-black/10' 
                : 'bg-white border-black/15 text-black group-hover:border-black'
            }`}>
              {currentGlobalStep > 1 ? "✓" : "1"}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
              currentGlobalStep === 1 ? 'text-black' : 'text-stone-400 group-hover:text-black'
            }`}>
              Armazón
            </span>
          </button>

          {/* Línea 1 -> 2 */}
          <div className="flex-1 mx-4 h-[1px] bg-stone-200/80 relative">
            <div className="absolute top-0 left-0 h-full bg-black transition-all duration-500" style={{ width: currentGlobalStep > 1 ? "100%" : "0%" }}></div>
          </div>

          {/* Paso 2: Cristales */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter border transition-all duration-300 ${
              currentGlobalStep === 2 
                ? 'bg-black border-black text-white scale-110 shadow-md shadow-black/10' 
                : (currentGlobalStep > 2 ? 'bg-white border-black/15 text-black' : 'bg-stone-100 border-stone-200 text-stone-300')
            }`}>
              {currentGlobalStep > 2 ? "✓" : "2"}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
              currentGlobalStep === 2 ? 'text-black' : (currentGlobalStep > 2 ? 'text-stone-600' : 'text-stone-300')
            }`}>
              Cristales
            </span>
          </div>

          {/* Línea 2 -> 3 */}
          <div className="flex-1 mx-4 h-[1px] bg-stone-200/80 relative">
            <div className="absolute top-0 left-0 h-full bg-black transition-all duration-500" style={{ width: currentGlobalStep > 2 ? "100%" : "0%" }}></div>
          </div>

          {/* Paso 3: Receta */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter border transition-all duration-300 ${
              currentGlobalStep === 3 
                ? 'bg-black border-black text-white scale-110 shadow-md shadow-black/10' 
                : 'bg-stone-100 border-stone-200 text-stone-300'
            }`}>
              3
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors ${
              currentGlobalStep === 3 ? 'text-black' : 'text-stone-300'
            }`}>
              Receta
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL (COLUMNAS) ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: Frame Selector (Minimalist) */}
        <div className="w-full lg:w-[45%] xl:w-[40%] h-full flex flex-col z-10 border-r border-stone-200/30">
          <div className="p-8 lg:p-12 pb-4 bg-[#fafafa] flex justify-between items-end shrink-0">
            <h1 className="text-[11px] uppercase tracking-[0.3em] font-bold text-black">Colección Receta</h1>
            <span className="text-[10px] text-[#999] tracking-widest">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'modelo' : 'modelos'}
            </span>
          </div>
          
          {/* ── FILTROS Y BÚSQUEDA ── */}
          <div className="px-8 lg:px-12 pb-6 bg-[#fafafa] flex flex-col gap-4 shrink-0">
            {/* Campo de Búsqueda */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar por marca o modelo..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200 hover:border-stone-300 focus:border-stone-400 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all placeholder:text-stone-400 text-stone-905"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-black text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Pills de Selección de Marcas */}
            {uniqueBrands.length > 2 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {uniqueBrands.map(brand => (
                  <button
                    key={brand}
                    onClick={() => setSelectedBrand(brand)}
                    className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-3.5 py-2 rounded-full border transition-all duration-300 ${
                      selectedBrand === brand 
                        ? 'bg-black border-black text-white' 
                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 pb-20 no-scrollbar">
            
            {/* Chat Bubbles (Mobile Only) */}
            {!selectedProduct && (
              <div className="lg:hidden w-full flex flex-col gap-3 mb-8">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="bg-white border border-stone-200 text-stone-800 p-4 rounded-2xl rounded-tl-sm shadow-sm w-[90%] self-start"
                >
                  <p className="text-[12px] font-medium leading-relaxed">
                    ¡Hola! 👋 Te voy a guiar paso a paso en el diseño de tus nuevos lentes a medida.
                  </p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 1.5 }}
                  className="bg-white border border-stone-200 text-stone-800 p-4 rounded-2xl rounded-tl-sm shadow-sm w-[95%] self-start"
                >
                  <p className="text-[12px] font-medium leading-relaxed">
                    El primer paso es elegir tu armazón. Abajo vas a encontrar nuestras opciones exclusivas en metal y acetato.
                  </p>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 2.8 }}
                  className="bg-stone-900 text-white p-3 rounded-2xl rounded-br-sm shadow-md w-[85%] self-end mt-2 text-center"
                >
                  <p className="text-[11px] font-bold tracking-wide uppercase">
                    👉 Seleccioná un modelo
                  </p>
                </motion.div>
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-4 bg-[#fafafa]">
                <p className="text-stone-400 text-[11px] uppercase tracking-widest mb-4">No se encontraron armazones</p>
                <button 
                  onClick={() => { setSearchQuery(""); setSelectedBrand("Todas"); }} 
                  className="text-[10px] font-bold uppercase tracking-[0.15em] underline underline-offset-4 text-black hover:opacity-60 transition-opacity"
                >
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-12">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  return (
                    <motion.button
                      whileHover={{ y: -5 }}
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      className="flex flex-col items-center text-center group focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                    >
                      <div className={`w-full aspect-[4/3] relative mb-6 flex items-center justify-center transition-all duration-500 isolate ${isSelected ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-100'}`}>
                        <Image 
                          src={(p.imagenesCatalogo.length > 0 ? resolveStorageUrl(p.imagenesCatalogo[0]) : "") || p.mockImage || "/images/placeholder.svg"}
                          alt={p.model || 'Anteojo'}
                          fill
                          style={{ objectFit: "contain", transform: "translateZ(0)" }}
                          className={`mix-blend-multiply ${((p.model || '').toLowerCase().includes('tl3932 c3') || (p.model || '').toLowerCase().includes('diana') || p.id === 'cmq5d11hf002rhy61fhvqs7nj') ? 'scale-125' : ''}`}
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      </div>
                      <p className={`text-[8px] uppercase tracking-[0.3em] font-bold mb-2 transition-colors duration-300 ${isSelected ? 'text-black' : 'text-[#999]'}`}>
                        {p.brand}
                      </p>
                      <h3 className={`text-sm font-serif uppercase tracking-tight transition-colors duration-300 ${isSelected ? 'text-black' : 'text-[#666]'}`}>
                        {p.model}
                      </h3>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Configurator (Desktop) */}
        <div className="hidden lg:flex w-full lg:w-[55%] xl:w-[60%] h-full p-6 lg:p-10 xl:p-12 items-center justify-center relative">
          {/* Subtle background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#f0f0f0] to-[#fafafa] opacity-50 pointer-events-none"></div>
          <AnimatePresence mode="wait">
            {configuratorContent}
          </AnimatePresence>
        </div>

        {/* OVERLAY: Configurator (Mobile) */}
        <AnimatePresence>
          {isMobileConfigOpen && (
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[100] bg-[#fafafa] lg:hidden flex flex-col"
            >
              {configuratorContent}
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
      
      {/* Hide scrollbars style */}
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
