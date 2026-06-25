"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LensConfigurator } from "./LensConfigurator";
import dynamic from "next/dynamic";
const Interactive3DImage = dynamic(() => import("./Interactive3DImage").then(mod => mod.Interactive3DImage), { ssr: false });
import Image from "next/image";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { Glasses, Disc3, ClipboardCheck, Search, Sparkles } from "lucide-react";

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

function getProductParts(name: string) {
  // Matches "Name C1" or "Name C10" at the end of string
  const match = name.match(/(.*)\s+(c\d+)\b/i);
  if (match) {
    return {
      baseName: match[1].trim(),
      variantLabel: match[2].toUpperCase().trim()
    };
  }
  return {
    baseName: name,
    variantLabel: "Standard"
  };
}

interface GroupedProduct {
  baseName: string;
  brand: string;
  price: number;
  category: string;
  variants: {
    id: string;
    label: string;
    stock: number;
    imagenesCatalogo: string[];
    slug: string;
    price: number;
  }[];
}

export function CustomGlassesBuilder({ products }: { products: Product[] }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  const [configuratorStep, setConfiguratorStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("Todas");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string>>({});
  
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

  // Group filtered products by base model name
  const groupedProducts: GroupedProduct[] = [];
  filteredProducts.forEach(p => {
    const { baseName, variantLabel } = getProductParts(p.model || p.id);
    let existing = groupedProducts.find(
      g => g.baseName.toLowerCase() === baseName.toLowerCase() && 
           g.brand.toLowerCase() === p.brand.toLowerCase()
    );
    if (!existing) {
      existing = {
        baseName,
        brand: p.brand,
        price: p.price,
        category: p.category,
        variants: []
      };
      groupedProducts.push(existing);
    }
    existing.variants.push({
      id: p.id,
      label: variantLabel,
      stock: p.stock,
      imagenesCatalogo: p.imagenesCatalogo,
      slug: p.slug,
      price: p.price
    });
  });

  const getActiveVariant = (group: GroupedProduct) => {
    const selectedId = selectedVariantIds[group.baseName];
    if (selectedId) {
      const found = group.variants.find(v => v.id === selectedId);
      if (found) return found;
    }
    return group.variants[0];
  };

  const handleSelectVariant = (baseName: string, variantId: string) => {
    setSelectedVariantIds(prev => ({
      ...prev,
      [baseName]: variantId
    }));
    if (selectedProduct) {
      const { baseName: selectedBaseName } = getProductParts(selectedProduct.model || selectedProduct.id);
      if (selectedBaseName.toLowerCase() === baseName.toLowerCase()) {
        const nextVariant = products.find(p => p.id === variantId);
        if (nextVariant) {
          setSelectedProduct(nextVariant);
        }
      }
    }
  };

  const handleCardClick = (group: GroupedProduct) => {
    const activeVariant = getActiveVariant(group);
    const origProduct = products.find(p => p.id === activeVariant.id);
    if (origProduct) {
      handleSelect(origProduct);
    }
  };

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
      className="w-full h-full bg-white/80 backdrop-blur-3xl lg:rounded-3xl p-6 lg:p-12 overflow-y-auto shadow-[0_30px_80px_-15px_rgba(0,0,0,0.08)] relative border border-white/60"
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
    <div className="w-full h-full flex flex-col items-center justify-center px-6 relative">
      {/* Decorative radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#c8a55c]/[0.04] blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col gap-4 relative z-10">
        {/* Asesor Avatar + Chat Bubble 1 */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1a1714] flex items-center justify-center shrink-0 mt-1 shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-[#c8a55c]" />
          </div>
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white border border-stone-200/80 text-stone-800 p-5 rounded-2xl rounded-tl-sm shadow-sm flex-1"
          >
            <p className="text-[13px] font-medium leading-relaxed">
              ¡Hola! 👋 Te voy a guiar paso a paso en el diseño de tus nuevos lentes a medida.
            </p>
          </motion.div>
        </div>

        {/* Chat Bubble 2 */}
        <div className="flex items-start gap-3">
          <div className="w-8 shrink-0" />
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.5 }}
            className="bg-white border border-stone-200/80 text-stone-800 p-5 rounded-2xl rounded-tl-sm shadow-sm flex-1"
          >
            <p className="text-[13px] font-medium leading-relaxed">
              El primer paso es elegir tu armazón. En el catálogo vas a encontrar nuestras opciones exclusivas en metal y acetato.
            </p>
          </motion.div>
        </div>

        {/* Chat Bubble 3 - CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 2.8 }}
          className="bg-gradient-to-r from-[#1a1714] to-[#2a2520] text-white p-5 rounded-2xl rounded-br-sm shadow-xl w-[85%] self-end mt-4 text-center border border-white/5"
        >
          <p className="text-[11px] font-black tracking-[0.15em] uppercase flex items-center justify-center gap-2">
            <Glasses className="w-4 h-4 text-[#c8a55c]" />
            Seleccioná un modelo
          </p>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-[calc(100dvh-72px)]">
      
      {/* ── BARRA DE PROCESO (STEPS) — Cinematic ── */}
      <div className="w-full bg-[#faf8f5] border-b border-[#e8e2db] px-4 py-3 md:py-4 flex justify-center items-center shrink-0 shadow-sm relative overflow-hidden z-20">
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[2px] bg-gradient-to-r from-transparent via-[#c8a55c]/15 to-transparent" />
        <div className="flex items-center justify-between w-full max-w-xl md:max-w-2xl px-2">
          {/* Paso 1: Armazón */}
          <button 
            onClick={handleClearSelection}
            className="flex flex-col items-center gap-1.5 group cursor-pointer focus:outline-none"
          >
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              currentGlobalStep === 1 
                ? 'bg-[#1a1714] text-white shadow-lg shadow-black/10 scale-110' 
                : currentGlobalStep > 1 
                  ? 'bg-[#c8a55c] text-white shadow-md shadow-[#c8a55c]/20'
                  : 'bg-stone-100 border border-stone-200 text-stone-400 group-hover:bg-stone-200/50 group-hover:text-stone-600'
            }`}>
              {currentGlobalStep > 1 ? <span className="text-sm font-bold">✓</span> : <Glasses className="w-4 h-4" strokeWidth={1.8} />}
            </div>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
              currentGlobalStep === 1 ? 'text-[#1a1714]' : currentGlobalStep > 1 ? 'text-[#c8a55c]' : 'text-stone-400'
            }`}>
              Armazón
            </span>
          </button>

          {/* Línea 1 -> 2 */}
          <div className="flex-1 mx-3 md:mx-5 h-[2px] bg-stone-200 rounded-full relative overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#c8a55c] to-[#d4b87a] rounded-full" 
              initial={false}
              animate={{ width: currentGlobalStep > 1 ? "100%" : "0%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Paso 2: Cristales */}
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              currentGlobalStep === 2 
                ? 'bg-[#1a1714] text-white shadow-lg shadow-black/10 scale-110' 
                : currentGlobalStep > 2 
                  ? 'bg-[#c8a55c] text-white shadow-md shadow-[#c8a55c]/20'
                  : 'bg-stone-100 border border-stone-200 text-stone-400'
            }`}>
              {currentGlobalStep > 2 ? <span className="text-sm font-bold">✓</span> : <Disc3 className="w-4 h-4" strokeWidth={1.8} />}
            </div>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
              currentGlobalStep === 2 ? 'text-[#1a1714]' : currentGlobalStep > 2 ? 'text-[#c8a55c]' : 'text-stone-400'
            }`}>
              Cristales
            </span>
          </div>

          {/* Línea 2 -> 3 */}
          <div className="flex-1 mx-3 md:mx-5 h-[2px] bg-stone-200 rounded-full relative overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#c8a55c] to-[#d4b87a] rounded-full" 
              initial={false}
              animate={{ width: currentGlobalStep > 2 ? "100%" : "0%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          {/* Paso 3: Receta */}
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              currentGlobalStep === 3 
                ? 'bg-[#1a1714] text-white shadow-lg shadow-black/10 scale-110' 
                : 'bg-stone-100 border border-stone-200 text-stone-400'
            }`}>
              <ClipboardCheck className="w-4 h-4" strokeWidth={1.8} />
            </div>
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] transition-colors ${
              currentGlobalStep === 3 ? 'text-[#1a1714]' : 'text-stone-400'
            }`}>
              Receta
            </span>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL (COLUMNAS) ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: Frame Selector (Minimalist) */}
        <div className="w-full lg:w-[45%] xl:w-[40%] h-full flex flex-col z-10 bg-[#faf8f5] relative overflow-hidden">
          {/* Ambient glow effects */}
          <div className="absolute top-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#c8a55c]/[0.03] blur-[100px] pointer-events-none" />
          <div className="absolute bottom-40 right-0 w-[200px] h-[200px] rounded-full bg-[#c8a55c]/[0.02] blur-[80px] pointer-events-none" />

          <div className="p-6 lg:p-10 pb-3 flex justify-between items-end shrink-0 relative z-10">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#c8a55c] mb-1">Paso 1</p>
              <h1 className="text-xl font-serif tracking-tight text-[#1a1714]">Elegí tu Armazón</h1>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-stone-500 bg-stone-100 border border-stone-200/80 px-2.5 py-1 rounded-full">
              {groupedProducts.length} {groupedProducts.length === 1 ? 'modelo' : 'modelos'}
            </span>
          </div>
          
          {/* ── FILTROS Y BÚSQUEDA ── */}
          <div className="px-6 lg:px-10 pb-5 flex flex-col gap-3 shrink-0 relative z-10">
            {/* Campo de Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Buscar por marca o modelo..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-stone-200/80 hover:border-stone-300 focus:border-[#c8a55c] rounded-xl pl-9 pr-4 py-2.5 text-xs focus:ring-2 focus:ring-[#c8a55c]/10 focus:outline-none transition-all placeholder:text-stone-400 text-stone-850 shadow-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold transition-colors"
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
                        ? 'bg-[#1a1714] border-[#1a1714] text-white shadow-md' 
                        : 'bg-white border-stone-200/80 text-stone-500 hover:border-stone-300 hover:text-stone-800 shadow-sm'
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 pb-20 no-scrollbar relative z-10">
            
            {/* Chat Bubbles (Mobile Only) */}
            {!selectedProduct && (
              <div className="lg:hidden w-full flex flex-col gap-3 mb-8">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="bg-white border border-stone-200/85 text-stone-800 p-4 rounded-2xl rounded-tl-sm w-[90%] self-start shadow-sm"
                >
                  <p className="text-[12px] font-medium leading-relaxed">
                    ¡Hola! 👋 Te voy a guiar paso a paso en el diseño de tus nuevos lentes a medida.
                  </p>
                </motion.div>
 
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 1.5 }}
                  className="bg-white border border-stone-200/85 text-stone-800 p-4 rounded-2xl rounded-tl-sm w-[95%] self-start shadow-sm"
                >
                  <p className="text-[12px] font-medium leading-relaxed">
                    El primer paso es elegir tu armazón. Abajo vas a encontrar nuestras opciones exclusivas en metal y acetato.
                  </p>
                </motion.div>
 
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 2.8 }}
                  className="bg-[#c8a55c] text-white p-3 rounded-2xl rounded-br-sm shadow-lg shadow-[#c8a55c]/20 w-[85%] self-end mt-2 text-center"
                >
                  <p className="text-[11px] font-black tracking-[0.1em] uppercase flex items-center justify-center gap-1.5">
                    <Glasses className="w-3.5 h-3.5" /> Seleccioná un modelo
                  </p>
                </motion.div>
              </div>
            )}
 
            {groupedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-4">
                <p className="text-stone-450 text-[11px] uppercase tracking-widest mb-4">No se encontraron armazones</p>
                <button 
                  onClick={() => { setSearchQuery(""); setSelectedBrand("Todas"); }} 
                  className="text-[10px] font-bold uppercase tracking-[0.15em] underline underline-offset-4 text-[#c8a55c] hover:opacity-60 transition-opacity"
                >
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-8">
                {groupedProducts.map((group) => {
                  const activeVariant = getActiveVariant(group);
                  const isSelected = selectedProduct?.id === activeVariant.id;
                  
                  return (
                    <div
                      key={group.baseName + group.brand}
                      className={`flex flex-col items-center text-center group relative rounded-2xl p-4 pb-5 transition-all duration-500 border bg-white ${
                        isSelected 
                          ? 'border-[#c8a55c] ring-1 ring-[#c8a55c]/30 shadow-lg shadow-[#c8a55c]/5' 
                          : 'border-stone-200/60 shadow-sm hover:border-stone-300/85 hover:shadow-md'
                      }`}
                    >
                      <button
                        onClick={() => handleCardClick(group)}
                        className="w-full flex flex-col items-center text-center focus:outline-none cursor-pointer"
                      >
                        {/* Selected badge */}
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute top-2.5 right-2.5 bg-[#c8a55c] text-white text-[7px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-full shadow-lg shadow-[#c8a55c]/30 z-10"
                          >
                            ✓ Elegido
                          </motion.div>
                        )}
 
                        <div className={`w-full aspect-[4/3] relative mb-3 flex items-center justify-center transition-all duration-500 isolate rounded-xl overflow-hidden bg-stone-50/50 ${isSelected ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-100'}`}>
                          <Image 
                            src={(activeVariant.imagenesCatalogo.length > 0 ? resolveStorageUrl(activeVariant.imagenesCatalogo[0]) : "") || "/images/placeholder.svg"}
                            alt={group.baseName}
                            fill
                            style={{ objectFit: "contain", transform: "translateZ(0)" }}
                            className={`${((group.baseName).toLowerCase().includes('tl3932') || (group.baseName).toLowerCase().includes('diana')) ? 'scale-125' : ''} brightness-105 contrast-[1.02]`}
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />
                        </div>
                        <p className={`text-[8px] uppercase tracking-[0.3em] font-bold mb-1 transition-colors duration-300 ${isSelected ? 'text-[#c8a55c]' : 'text-stone-400 group-hover:text-stone-500'}`}>
                          {group.brand}
                        </p>
                        <h3 className={`text-sm font-serif uppercase tracking-tight transition-colors duration-300 mb-1.5 ${isSelected ? 'text-[#1a1714]' : 'text-stone-800 group-hover:text-black'}`}>
                          {group.baseName}
                        </h3>
                        <p className={`text-[11px] font-bold transition-colors duration-300 ${isSelected ? 'text-[#c8a55c]' : 'text-stone-600'}`}>
                          ${activeVariant.price.toLocaleString()}
                        </p>
                      </button>

                      {/* Variant Selector (Pills) */}
                      {group.variants.length > 1 && (
                        <div className="flex gap-1.5 mt-3 flex-wrap justify-center relative z-20">
                          {group.variants.map((v) => {
                            const isVariantActive = activeVariant.id === v.id;
                            return (
                              <button
                                key={v.id}
                                onClick={(e) => {
                                  e.stopPropagation(); // prevent card click
                                  handleSelectVariant(group.baseName, v.id);
                                }}
                                className={`text-[8px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-all ${
                                  isVariantActive
                                    ? 'bg-[#1a1714] border-[#1a1714] text-white font-black'
                                    : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                                }`}
                              >
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Configurator (Desktop) */}
        <div className="hidden lg:flex w-full lg:w-[55%] xl:w-[60%] h-full p-6 lg:p-10 xl:p-12 items-center justify-center relative bg-[#faf8f5]">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#f5f0ea] via-[#faf8f5] to-[#f8f6f3] pointer-events-none" />
          <div className="absolute top-20 right-20 w-[500px] h-[500px] rounded-full bg-[#c8a55c]/[0.04] blur-[120px] pointer-events-none" />
          <div className="absolute bottom-20 left-20 w-[350px] h-[350px] rounded-full bg-stone-400/[0.05] blur-[80px] pointer-events-none" />
          {/* Left edge glow from dark panel */}
          <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-black/[0.03] to-transparent pointer-events-none" />
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
