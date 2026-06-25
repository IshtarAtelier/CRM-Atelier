"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, ShoppingBag, X, ShoppingCart, Gem, Glasses, BookOpen, Users, MapPin, HelpCircle, Star, MessageCircle, ChevronRight } from "lucide-react";
import { useCart } from "@/store/useCart";
import dynamic from "next/dynamic";
const CartSidebar = dynamic(() => import('./CartSidebar').then(mod => mod.CartSidebar), { ssr: false });
import { resolveStorageUrl } from "@/lib/utils/storage";
import Image from "next/image";
import { usePathname } from "next/navigation";

interface StorefrontNavbarProps {
  theme?: "light" | "dark"; // dark = dark background (needs white text), light = light background (needs black text)
  mixBlend?: boolean;
}

export function StorefrontNavbar({ theme = "dark", mixBlend = false }: StorefrontNavbarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const { items, setIsOpen: setCartOpen } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [webSettings, setWebSettings] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Check localStorage
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === 'OPTICA') setCurrentUser(u);
      } catch (e) {}
    }

    // Verify session
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        if (data.role === 'OPTICA') {
          setCurrentUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        } else {
          setCurrentUser(null);
          localStorage.removeItem('user');
        }
      })
      .catch(() => {
        setCurrentUser(null);
        localStorage.removeItem('user');
      });
  }, []);

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
        <div className={`px-3 sm:px-5 py-1 flex justify-between items-center transition-all duration-300 ${headerBgClass} ${mixBlend && !isHeaderScrolled ? 'mix-blend-difference text-white' : ''}`}>
          {/* Izquierda: Links de navegación */}
          <div className="flex-1 flex justify-start">
            <nav className="flex gap-2 lg:gap-6 items-center">
                <Link 
                  href="/tienda" 
                  className={`relative group text-[11px] lg:text-[13px] font-medium ${activeTextColorClass} p-2 lg:p-0 hidden lg:block transition-colors`} 
                  style={activeTextShadowStyle}
                >
                  Shop
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-current transition-all duration-300 group-hover:w-full opacity-80"></span>
                </Link>
                <Link 
                  href="/cristales-opticos" 
                  className={`relative group text-[11px] lg:text-[13px] font-medium ${activeTextColorClass} p-2 lg:p-0 hidden lg:block transition-colors`} 
                  style={activeTextShadowStyle}
                >
                  Cristales
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-current transition-all duration-300 group-hover:w-full opacity-80"></span>
                </Link>
                <Link 
                  href="/arma-tus-lentes" 
                  className={`relative group text-[13px] font-bold ${activeTextColorClass} hidden lg:block transition-colors pb-0.5`} 
                  style={activeTextShadowStyle}
                >
                  Lentes a Medida
                  <span className={`absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 opacity-80 ${pathname === '/arma-tus-lentes' ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                </Link>
    
              <div 
                className="relative"
                onMouseEnter={() => setIsExploreOpen(true)}
                onMouseLeave={() => setIsExploreOpen(false)}
              >
                <button aria-expanded={isExploreOpen} aria-haspopup="true" 
                  className={`flex items-center gap-0.5 lg:gap-1 text-[11px] lg:text-[13px] font-medium ${activeTextColorClass} hover:opacity-60 transition-opacity p-2 lg:p-0`}
                  style={activeTextShadowStyle}
                >
                  <span className="hidden lg:inline">Explore</span>
                  <span className="lg:hidden">Menú</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
    
                <AnimatePresence>
                  {isExploreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute top-full left-0 mt-3 w-[280px] bg-[#0f0e0c] shadow-2xl shadow-black/40 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl"
                    >
                      {/* Mobile-only links */}
                      <div className="lg:hidden border-b border-white/10 py-2 px-2">
                        <Link href="/tienda" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <ShoppingCart className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Shop
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/cristales-opticos" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <Gem className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Cristales
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/arma-tus-lentes" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <Glasses className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Lentes a Medida
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>

                      {/* Main links */}
                      <div className="py-2 px-2">
                        <Link href="/blog" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <BookOpen className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          El Blog
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/quienes-somos" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <Users className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Quiénes Somos
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/nuestro-local" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <MapPin className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Nuestro Local
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/faq" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <HelpCircle className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Preguntas Frecuentes
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                        <Link href="/resenas" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all group">
                          <Star className="w-4 h-4 text-[#c8a55c] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                          Opiniones de Clientes
                          <ChevronRight className="w-3 h-3 text-white/20 ml-auto group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                      </div>

                      {/* CTA Footer */}
                      <div className="border-t border-white/10 p-3">
                        <Link href="/contacto" className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[#c8a55c]/10 border border-[#c8a55c]/20 text-[12px] font-bold text-[#c8a55c] hover:bg-[#c8a55c]/20 transition-all group">
                          <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
                          Consulta y Contactos
                          <ChevronRight className="w-3 h-3 opacity-50 ml-auto group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>
          </div>
          
          {/* Centro: Texto logo */}
          <div className="flex-shrink-0 flex justify-center z-10 px-2">
            <Link 
              href="/" 
              className={`text-[11px] sm:text-[14px] md:text-[16px] font-bold tracking-[0.05em] sm:tracking-[0.10em] md:tracking-[0.15em] ${activeTextColorClass} drop-shadow-md text-center whitespace-nowrap`} 
              style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
            >
              ATELIER ÓPTICA
            </Link>
          </div>
  
          {/* Derecha: Iconos */}
          <div className={`flex-1 flex justify-end items-center gap-1.5 sm:gap-4 ${activeTextColorClass}`}>
            {currentUser && currentUser.role === 'OPTICA' && (
              <div className="flex items-center gap-1.5 sm:gap-2 mr-1 sm:mr-2">
                <span className="text-[8px] sm:text-[9.5px] font-black uppercase bg-[#b08f4c] text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full whitespace-nowrap shadow-sm hidden sm:block">
                  Óptica: {currentUser.name}
                </span>
                <span className="text-[8px] font-black uppercase bg-[#b08f4c] text-white px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm sm:hidden">
                  Ópt.
                </span>
                <button
                  onClick={async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                  }}
                  className="text-[8px] sm:text-[9.5px] font-black uppercase text-stone-400 hover:text-red-500 transition-colors ml-1"
                >
                  Salir
                </button>
              </div>
            )}
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
                className="w-full text-2xl md:text-4xl font-light tracking-tight border-b border-stone-200 dark:border-stone-850 pb-4 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-transparent placeholder-stone-300 dark:placeholder-stone-700 text-stone-900 dark:text-stone-100 focus:border-black dark:focus:border-white transition-colors"
              />
            </div>

            {/* Results */}
            <div className="max-w-4xl mx-auto w-full flex-1 overflow-y-auto pr-2">
              {searchQuery.trim().length < 2 ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sugerencias</p>
                  <div className="flex flex-wrap gap-2">
                    {["Receta", "Sol", "Clip-On"].map(term => (
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
                            <Image src={imgUrl} alt={p.model} fill sizes="64px" className="object-contain mix-blend-multiply dark:mix-blend-normal" />
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
