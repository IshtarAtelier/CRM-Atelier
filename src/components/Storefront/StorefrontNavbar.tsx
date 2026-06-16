"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/store/useCart";
import { CartSidebar } from "./CartSidebar";
import { resolveStorageUrl } from "@/lib/utils/storage";

interface StorefrontNavbarProps {
  theme?: "light" | "dark"; // dark = dark background (needs white text), light = light background (needs black text)
  mixBlend?: boolean;
}

export function StorefrontNavbar({ theme = "dark", mixBlend = false }: StorefrontNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const { items, setIsOpen: setCartOpen } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [webSettings, setWebSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setWebSettings(data);
      })
      .catch(err => console.error("Error loading web settings for navbar:", err));
  }, []);

  useEffect(() => {
    if (isSearchOpen && allProducts.length === 0) {
      fetch('/api/store/products')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAllProducts(data);
          }
        })
        .catch(err => console.error("Error loading products for search:", err));
    }
  }, [isSearchOpen, allProducts]);

  const searchResults = searchQuery.trim().length >= 2
    ? allProducts.filter(p => {
        const term = searchQuery.toLowerCase();
        return (p.brand || '').toLowerCase().includes(term) ||
               (p.name || '').toLowerCase().includes(term) ||
               (p.model || '').toLowerCase().includes(term) ||
               (p.category || '').toLowerCase().includes(term);
      })
    : [];

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

  const showAnnouncement = webSettings ? webSettings.web_announcement_active : true;
  const announcementText = webSettings ? webSettings.web_announcement_text : "6 Cuotas Sin Interés • 15% OFF en Efectivo o Transferencia • Envío Gratis";
  const announcementLink = webSettings ? webSettings.web_announcement_link : "/tienda";

  return (
    <>
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isHeaderScrolled ? 'shadow-sm border-b border-[#e8e2db]/50 bg-[#faf8f5]/90' : 'bg-transparent'}`}>
        {/* Dynamic Announcement Bar */}
        {showAnnouncement && (
          <div className="w-full bg-black text-white text-center py-2 px-3 text-[9px] font-black uppercase tracking-[0.25em] relative z-10 transition-all shadow-sm flex items-center justify-center gap-1.5">
            {announcementLink ? (
              <Link href={announcementLink} className="hover:underline flex items-center justify-center gap-1 hover:opacity-90">
                {announcementText}
              </Link>
            ) : (
              <span>{announcementText}</span>
            )}
          </div>
        )}

        {/* Navbar Inner Row */}
        <div className={`px-3 sm:px-5 flex justify-between items-center transition-all duration-300 ${headerBgClass} ${mixBlend && !isHeaderScrolled ? 'mix-blend-difference text-white' : ''}`}>
          {/* Izquierda: Links de navegación */}
          <nav className="flex gap-2 sm:gap-6 items-center">
              <Link 
                href="/tienda" 
                className={`text-[11px] sm:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity p-2 sm:p-0`} 
                style={activeTextShadowStyle}
              >
                Shop
              </Link>
              <Link 
                href="/cristales-opticos" 
                className={`text-[11px] sm:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity p-2 sm:p-0`} 
                style={activeTextShadowStyle}
              >
                Cristales
              </Link>
              <Link 
                href="/arma-tus-lentes" 
                className={`text-[13px] font-bold ${activeTextColorClass} hover:opacity-60 transition-opacity border-b-2 border-primary pb-0.5 hidden sm:block`} 
                style={activeTextShadowStyle}
              >
                Lentes a Medida
              </Link>
  
            <div 
              className="relative"
              onMouseEnter={() => setIsExploreOpen(true)}
              onMouseLeave={() => setIsExploreOpen(false)}
            >
              <button 
                className={`flex items-center gap-0.5 sm:gap-1 text-[11px] sm:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity p-2 sm:p-0`}
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
          <div className={`flex items-center gap-1 sm:gap-5 ${activeTextColorClass}`}>
            <button 
              onClick={() => setIsSearchOpen(true)} 
              className="hover:opacity-60 transition-opacity p-2 sm:p-0" 
              aria-label="Buscar"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
            </button>
            <button 
              className="hover:opacity-60 transition-opacity relative p-2 sm:p-0" 
              aria-label="Carrito"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.5} />
              <span className={`absolute top-0.5 right-0.5 sm:-top-1.5 sm:-right-1.5 text-[8px] sm:text-[9px] font-bold ${isDark && !isHeaderScrolled ? 'text-white bg-black/50' : 'text-[#433831] bg-stone-200'} rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center backdrop-blur-sm pointer-events-none`}>
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>
      <CartSidebar />

      {/* Luxury Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#faf8f5]/98 dark:bg-stone-950/98 backdrop-blur-lg flex flex-col p-6 md:p-16 text-black dark:text-white"
          >
            {/* Close button */}
            <div className="flex justify-between items-center mb-12">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Buscar en Atelier</span>
              <button 
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                aria-label="Cerrar búsqueda"
              >
                <X className="w-6 h-6 text-stone-600 dark:text-stone-300" />
              </button>
            </div>

            {/* Input field */}
            <div className="max-w-4xl mx-auto w-full mb-10">
              <input
                type="text"
                autoFocus
                placeholder="Buscar por modelo, marca o categoría..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-2xl md:text-4xl font-light tracking-tight border-b border-stone-200 dark:border-stone-850 pb-4 outline-none bg-transparent placeholder-stone-300 dark:placeholder-stone-700 text-stone-900 dark:text-stone-100 focus:border-black dark:focus:border-white transition-colors"
              />
            </div>

            {/* Results */}
            <div className="max-w-4xl mx-auto w-full flex-1 overflow-y-auto pr-2">
              {searchQuery.trim().length < 2 ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sugerencias</p>
                  <div className="flex flex-wrap gap-2">
                    {["Receta", "Sol", "XL", "Clip-On"].map(term => (
                      <button
                        key={term}
                        onClick={() => setSearchQuery(term)}
                        className="px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-full text-xs font-medium hover:border-black dark:hover:border-white transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                  {searchResults.map(p => {
                    const imgUrl = p.imagenesCatalogo?.length > 0
                      ? resolveStorageUrl(p.imagenesCatalogo[0])
                      : null;
                    return (
                      <Link
                        key={p.id}
                        href={`/producto/${p.slug || p.id}`}
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="flex gap-4 p-3 border border-stone-100 dark:border-stone-900 bg-white dark:bg-stone-950 rounded-2xl hover:shadow-md transition-shadow group"
                      >
                        <div className="w-16 h-16 bg-[#f5f5f5] dark:bg-stone-900 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative">
                          {imgUrl ? (
                            <img src={imgUrl} alt={p.model} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                          ) : (
                            <Search className="w-6 h-6 text-stone-300" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{p.brand || 'ATELIER'}</span>
                          <span className="text-sm font-medium text-stone-850 dark:text-stone-100 leading-tight group-hover:text-black dark:group-hover:text-white transition-colors">
                            {p.name || p.model}
                          </span>
                          <span className="text-xs text-[#b08f4c] dark:text-[#c8a55c] font-bold mt-1">
                            ${(p.price || 0).toLocaleString("es-AR")}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-stone-400 dark:text-stone-500 text-sm italic">No se encontraron productos que coincidan con &quot;{searchQuery}&quot;.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
