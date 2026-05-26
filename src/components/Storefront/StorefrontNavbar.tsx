"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, User, ShoppingBag } from "lucide-react";
import { useCart } from "@/store/useCart";
import { CartSidebar } from "./CartSidebar";

interface StorefrontNavbarProps {
  theme?: "light" | "dark"; // dark = dark background (needs white text), light = light background (needs black text)
  mixBlend?: boolean;
}

export function StorefrontNavbar({ theme = "dark", mixBlend = false }: StorefrontNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const { items, setIsOpen: setCartOpen } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isDark = theme === "dark";
  const isHeaderScrolled = scrolled;
  
  // Scrolled style (white background with glassmorphism), otherwise transparent
  const headerBgClass = isHeaderScrolled 
    ? "bg-[#faf8f5]/90 backdrop-blur-md shadow-sm border-b border-[#e8e2db]/50 py-3" 
    : "bg-transparent py-3.5 sm:py-4";
    
  // Scrolled text is always dark brown for legibility, otherwise relies on isDark prop
  const activeTextColorClass = isHeaderScrolled ? "text-[#433831]" : (isDark ? "text-white" : "text-[#433831]");
  const activeTextShadowStyle = (isDark && !isHeaderScrolled) ? { textShadow: "0 1px 3px rgba(0,0,0,0.3)" } : {};

  return (
    <>
      <header className={`fixed top-0 w-full z-50 px-3 sm:px-5 flex justify-between items-center transition-all duration-300 ${headerBgClass} ${mixBlend && !isHeaderScrolled ? 'mix-blend-difference text-white' : ''}`}>
        {/* Izquierda: Links de navegación */}
        <nav className="flex gap-3 sm:gap-6 items-center">
            <Link 
              href="/tienda" 
              className={`text-[11px] sm:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity`} 
              style={activeTextShadowStyle}
            >
              Shop
            </Link>
            <Link 
              href="/arma-tus-lentes" 
              className={`text-[13px] font-bold ${activeTextColorClass} hover:opacity-60 transition-opacity border-b-2 border-primary pb-0.5 hidden sm:block`} 
              style={activeTextShadowStyle}
            >
              Armá tus Lentes
            </Link>

          {/* Explore Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setIsExploreOpen(true)}
            onMouseLeave={() => setIsExploreOpen(false)}
          >
            <button 
              className={`flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity`}
              style={activeTextShadowStyle}
            >
              Explore <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            <AnimatePresence>
              {isExploreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-white shadow-xl rounded-xl border border-stone-100 overflow-hidden py-2"
                >
                  <Link href="/blog" className="block px-4 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                    El Blog
                  </Link>
                  <Link href="/nuestro-local" className="block px-4 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                    Nuestro Local
                  </Link>
                  <Link href="/faq" className="block px-4 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                    Preguntas Frecuentes
                  </Link>
                  <Link href="/resenas" className="block px-4 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                    Opiniones de Clientes
                  </Link>
                  <Link href="/contacto" className="block px-4 py-2 text-[12px] font-medium text-stone-700 hover:bg-stone-50 transition-colors">
                    Consulta y Contactos
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
        
        {/* Centro: Texto logo */}
        <Link 
          href="/" 
          className={`absolute left-1/2 -translate-x-1/2 text-[12px] sm:text-[16px] font-bold tracking-[0.08em] sm:tracking-[0.15em] ${activeTextColorClass} drop-shadow-md`} 
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
        >
          ATELIER ÓPTICA
        </Link>

        {/* Derecha: Iconos */}
        <div className={`flex items-center gap-3 sm:gap-5 ${activeTextColorClass}`}>
          <button className="hover:opacity-60 transition-opacity" aria-label="Buscar">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
          </button>
          <Link href="/admin" className="hover:opacity-60 transition-opacity" aria-label="Mi cuenta">
            <User className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
          </Link>
          <button 
            className="hover:opacity-60 transition-opacity relative" 
            aria-label="Carrito"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
            <span className={`absolute -top-1.5 -right-1.5 text-[8px] sm:text-[9px] font-bold ${isDark && !isHeaderScrolled ? 'text-white bg-black/50' : 'text-[#433831] bg-stone-200'} rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center backdrop-blur-sm`}>
              {cartCount}
            </span>
          </button>
        </div>
      </header>
      
      {/* Sidebar de Carrito */}
      <CartSidebar />
    </>
  );
}
