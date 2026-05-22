"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LensConfigurator } from "./LensConfigurator";
import { Interactive3DImage } from "./Interactive3DImage";
import Image from "next/image";
import { useCart } from "@/store/useCart";

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
  const { setIsOpen: setCartOpen } = useCart();

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    if (window.innerWidth < 1024) {
      setIsMobileConfigOpen(true);
    }
  };

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
          src={selectedProduct.imagenesCatalogo.length > 0 
            ? (selectedProduct.imagenesCatalogo[0].startsWith('http') || selectedProduct.imagenesCatalogo[0].startsWith('/images') 
                ? selectedProduct.imagenesCatalogo[0] 
                : `/api/storage/view?key=${encodeURIComponent(selectedProduct.imagenesCatalogo[0])}`)
            : (selectedProduct.mockImage || "/images/placeholder.svg")
          }
          alt={selectedProduct.model}
          className="w-full max-w-[280px] h-40 mb-6"
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
          image: selectedProduct.imagenesCatalogo.length > 0 
            ? (selectedProduct.imagenesCatalogo[0].startsWith('http') || selectedProduct.imagenesCatalogo[0].startsWith('/images')
                ? selectedProduct.imagenesCatalogo[0]
                : `/api/storage/view?key=${encodeURIComponent(selectedProduct.imagenesCatalogo[0])}`)
            : (selectedProduct.mockImage || "/images/placeholder.svg")
        }}
        onSuccess={() => {
          setIsMobileConfigOpen(false);
          setCartOpen(true);
        }}
      />
    </motion.div>
  ) : (
    <motion.div 
      key="placeholder"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="w-full h-full flex flex-col items-center justify-center text-center px-10"
    >
      <div className="w-[1px] h-24 bg-black/20 mb-12"></div>
      <h3 className="text-4xl lg:text-5xl font-serif uppercase tracking-tight mb-6 text-black/90 leading-tight">
        Comenzá por el<br/><i className="text-black/50">armazón</i>
      </h3>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#999] max-w-sm font-bold">
        Seleccioná un modelo del catálogo para iniciar la configuración de tus cristales.
      </p>
    </motion.div>
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100dvh-72px)] bg-[#fafafa]">
      {/* LEFT: Frame Selector (Minimalist) */}
      <div className="w-full lg:w-[45%] xl:w-[40%] h-full flex flex-col z-10">
        <div className="p-8 lg:p-12 pb-6 bg-[#fafafa] sticky top-0 z-20 flex justify-between items-end">
          <h1 className="text-[11px] uppercase tracking-[0.3em] font-bold text-black">Colección Receta</h1>
          <span className="text-[10px] text-[#999] tracking-widest">{products.length} modelos</span>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 lg:px-10 pb-20 no-scrollbar">
          <div className="grid grid-cols-2 gap-x-6 gap-y-12">
            {products.map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              return (
                <motion.button
                  whileHover={{ y: -5 }}
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="flex flex-col items-center text-center group outline-none"
                >
                  <div className={`w-full aspect-[4/3] relative mb-6 flex items-center justify-center transition-all duration-500 ${isSelected ? 'opacity-100 scale-105' : 'opacity-70 group-hover:opacity-100'}`}>
                    <Image 
                      src={p.imagenesCatalogo.length > 0 
                        ? (p.imagenesCatalogo[0].startsWith('http') || p.imagenesCatalogo[0].startsWith('/images')
                            ? p.imagenesCatalogo[0]
                            : `/api/storage/view?key=${encodeURIComponent(p.imagenesCatalogo[0])}`)
                        : (p.mockImage || "/images/placeholder.svg")
                      }
                      alt={p.model}
                      fill
                      className="object-contain mix-blend-multiply"
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
