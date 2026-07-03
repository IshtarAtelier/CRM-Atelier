"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { resolveStorageUrl } from "@/lib/utils/storage";

const CATEGORIES = ["Todo", "Receta", "Sol", "Clip-On", "Contacto", "Cristales"];

const CATEGORY_IMAGES: Record<string, string> = {
  "Todo": "/images/banners/todo.png",
  "Receta": "/images/banners/receta.png",
  "Sol": "/images/banners/sol.png",
  "Clip-On": "/images/banners/clipon.png",
  "Contacto": "/images/banners/contacto.png",
  "Cristales": "/images/banners/cristales.png"
};

// Removed duplicated isXlProduct function

export function TiendaClient({ 
  initialProducts,
  availableBrands = [],
  availableShapes = [],
  availableMaterials = [],
  footer
}: { 
  initialProducts: any[];
  availableBrands?: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
  footer?: React.ReactNode;
}) {
  const [activeCategory, setActiveCategory] = useState("Todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);

  const searchParams = useSearchParams();
  const filterBrand = searchParams.get('marca') || '';
  const filterShape = searchParams.get('forma') || '';
  const filterMaterial = searchParams.get('material') || '';
  const filterGender = searchParams.get('genero') || '';
  const sortParam = searchParams.get('orden') || 'recientes';

  useEffect(() => {
    setVisibleCount(24);
  }, [activeCategory, searchQuery, filterGender]);

  const [isWholesale, setIsWholesale] = useState(false);
  const [webSettings, setWebSettings] = useState({
    web_promo_cash_discount: 15,
    web_promo_installments: "6 cuotas sin interés"
  });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === 'OPTICA') setIsWholesale(true);
      } catch (e) {}
    }

    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        if (data.role === 'OPTICA') {
          setIsWholesale(true);
        } else {
          setIsWholesale(false);
        }
      })
      .catch(() => {
        setIsWholesale(false);
      });
  }, []);

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

  // ── STATE FOR PRODUCTS & PAGINATION ──
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(initialProducts.length);
  const [isLoading, setIsLoading] = useState(false);
  const isRecoveringProducts = isLoading;

  // Whenever filters change, reset page to 1
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, filterBrand, filterShape, filterMaterial, filterGender, sortParam, isWholesale]);

  // Load products from API based on current filters and page
  useEffect(() => {
    let active = true;

    // Check if it's the initial server load (page 1, no filters, not wholesale)
    const isFirstRenderWithInitialData =
      currentPage === 1 &&
      activeCategory === "Todo" &&
      searchQuery === "" &&
      !filterBrand &&
      !filterShape &&
      !filterMaterial &&
      !filterGender &&
      sortParam === "recientes" &&
      !isWholesale;

    if (isFirstRenderWithInitialData && products.length > 0) {
      return;
    }

    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', currentPage.toString());
        queryParams.set('limit', '24');
        queryParams.set('category', activeCategory);
        if (filterBrand) queryParams.set('brand', filterBrand);
        if (filterShape) queryParams.set('shape', filterShape);
        if (filterMaterial) queryParams.set('material', filterMaterial);
        if (filterGender) queryParams.set('gender', filterGender);
        queryParams.set('sort', sortParam);
        if (searchQuery) queryParams.set('search', searchQuery);
        if (isWholesale) queryParams.set('channel', 'wholesale');

        const res = await fetch(`/api/store/products?${queryParams.toString()}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (active) {
          if (currentPage === 1) {
            setProducts(data.products || []);
          } else {
            setProducts(prev => {
              // Deduplicate products just in case
              const existingIds = new Set(prev.map(p => p.id));
              const newProducts = (data.products || []).filter((p: any) => !existingIds.has(p.id));
              return [...prev, ...newProducts];
            });
          }
          setTotalPages(data.totalPages || 1);
          setTotalCount(data.totalCount || 0);
        }
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [currentPage, activeCategory, searchQuery, filterBrand, filterShape, filterMaterial, filterGender, sortParam, isWholesale]);

  const displayedProducts = products;

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />

      {/* ── HERO BAR (TEXT) ── */}
      <div className="pt-28 pb-8 bg-white border-b border-stone-100">
        <div className="max-w-[1600px] mx-auto px-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 mb-2">Atelier Óptica</p>
            <h1 className="text-4xl md:text-5xl font-serif">
              Colección
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
            Armazones seleccionados a mano. Cada pieza elegida por diseño, calidad y carácter.
          </p>
        </div>
      </div>

      {/* ── DYNAMIC HERO BANNER ── */}
      <div className="w-full">
        {/* Image Container */}
        <div className="relative w-full h-[350px] md:h-[450px] lg:h-[550px] bg-stone-200 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              <Image
                src={CATEGORY_IMAGES[activeCategory] || CATEGORY_IMAGES["Todo"]}
                alt={`Colección ${activeCategory}`}
                fill
                priority
                className="object-cover object-center"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-black/20" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
             <h1 className="text-white text-5xl md:text-7xl font-serif text-center drop-shadow-2xl tracking-tight">
                {activeCategory === "Todo" ? "Nueva Colección" : activeCategory}
             </h1>
          </div>
        </div>

        {/* ── BANNER DE CATEGORÍAS Y PROMOS ── */}
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-[1600px] mx-auto px-5 py-4 flex flex-col xl:flex-row items-center justify-between gap-4">
            
            {/* Espacio vacío para equilibrar en desktop si fuera necesario, o promos a la izquierda */}
            <div className="hidden xl:flex flex-1 items-center gap-3">
               <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                  ENVÍO GRATIS A TODO EL PAÍS
               </span>
            </div>

            {/* Categorías (Centro) */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 text-[10px] md:text-[11px] font-black uppercase tracking-widest px-5 md:px-6 py-2.5 md:py-3 rounded-full transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-black text-white shadow-md scale-105"
                      : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-black"
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

            {/* Promos (Derecha) */}
            <div className="flex xl:flex-1 justify-center xl:justify-end items-center gap-3 w-full xl:w-auto">
               {isWholesale ? (
                 <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    Tarifa Mayorista Activa
                 </span>
               ) : (
                 <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    {discountRate * 100}% OFF TRANSFERENCIA
                 </span>
               )}
               <span className="xl:hidden text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                  ENVÍO GRATIS
               </span>
            </div>
            
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-5 py-12 pb-20 flex flex-col lg:flex-row gap-8 lg:gap-12 relative">
        <aside className="w-full lg:w-64 flex-shrink-0">
          <ProductFilters 
            availableBrands={availableBrands} 
            availableShapes={availableShapes}
            availableMaterials={availableMaterials}
          />
        </aside>

        <div className="flex-1">
          {/* Buscador de Productos */}
          <div className="mb-10 w-full max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre, modelo o marca..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 text-stone-900 px-5 py-3.5 pr-12 text-xs font-medium tracking-wider uppercase rounded-full focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all duration-300 shadow-sm placeholder:text-stone-400"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-stone-400 hover:text-black p-1 transition-colors"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <svg
                  className="w-4 h-4 text-stone-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            {searchQuery && (
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2 px-2">
                Resultados para &quot;{searchQuery}&quot;: {totalCount} {totalCount === 1 ? "modelo encontrado" : "modelos encontrados"}
              </p>
            )}
          </div>

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
              {displayedProducts.length === 0 ? (
                isRecoveringProducts ? (
                  /* Show skeleton cards while recovering products — never show empty */
                  <>{Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="col-span-1 animate-pulse">
                      <div className="bg-stone-200 aspect-square mb-4 rounded" />
                      <div className="h-3 bg-stone-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-stone-200 rounded w-1/2" />
                    </div>
                  ))}</>
                ) : (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-serif text-stone-900 mb-2">No encontramos resultados</p>
                    <p className="text-stone-500 mb-6 max-w-md mx-auto">Intentá ajustar los filtros o explorar otra categoría. Tenemos opciones increíbles esperándote.</p>
                    <Link href="/tienda" className="bg-black text-white px-8 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors">
                      Ver Toda la Colección
                    </Link>
                  </div>
                )
              ) : (
                displayedProducts.map((p, index) => {
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
                      {/* Badges en la esquina superior derecha */}
                      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                        {!isWholesale && (
                          <span className="bg-[#1a1a1a] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 shadow-sm">
                            {webSettings.web_promo_cash_discount}% OFF
                          </span>
                        )}
                        {p.stock !== undefined && p.stock > 0 && p.stock <= 3 && (
                          <span className="bg-red-650 text-white text-[7.5px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded shadow-md animate-pulse">
                            Últimas {p.stock} u.
                          </span>
                        )}
                      </div>

                      {/* Contenedor de imágenes con efecto zoom */}
                      <div className="absolute inset-0 transition-transform duration-700 ease-out md:group-hover:scale-110">
                        {imgUrl ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Image unoptimized
                              src={imgUrl}
                              alt={`${p.brand} ${p.model}`}
                              fill
                              priority={index < 4}
                              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                              className={`object-contain mix-blend-multiply transition-opacity duration-500 ease-in-out ${
                                ((p.model || '').toLowerCase().includes('tl3932 c3') || p.id === 'cmq5d11hf002rhy61fhvqs7nj')
                                  ? "scale-125"
                                  : (p.model || '').toLowerCase().includes('diana')
                                    ? "scale-110"
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
                          <Image unoptimized
                            src={secondImgUrl}
                            alt={`${p.brand} ${p.model} Try-On`}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                            className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out"
                          />
                        )}
                      </div>

                      {/* Badge categoría */}
                      {p.category && (
                        <span className="absolute top-3 left-3 text-[8px] font-black uppercase tracking-widest bg-white/80 backdrop-blur-sm px-2 py-1 z-10">
                          {p.shape === "XL" ? `${p.category} · XL` : p.category}
                        </span>
                      )}

                      {/* Titanium Badge */}
                      {p.material === "Titanio" && (
                        <span className="absolute bottom-3 left-3 text-[8px] font-black uppercase tracking-[0.18em] bg-stone-900/90 text-stone-100 backdrop-blur-sm px-2.5 py-1 z-10 border border-stone-800 shadow-md flex items-center gap-1.5 rounded-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Titanium
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1 mt-4 px-1 pb-4">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3 className="text-[10px] text-stone-500 font-black uppercase tracking-[0.20em]">{p.brand || 'ATELIER'}</h3>
                        {p.material === "Titanio" && (
                          <span className="text-[8px] font-black uppercase tracking-[0.15em] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                            Titanium
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-serif tracking-tight text-black leading-tight mb-3 group-hover:text-stone-600 transition-colors">
                        {p.name || p.model}
                      </h2>
                      
                      {isWholesale ? (
                        <div className="pt-3 flex flex-col gap-1">
                          <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max">
                            Precio Mayorista
                          </span>
                          <div className="flex items-center gap-2 animate-in fade-in">
                            <p className="text-lg font-black text-blue-600 tracking-tight">
                              ${(p.wholesalePrice || p.price || 0).toLocaleString("es-AR")}
                            </p>
                            {p.wholesalePrice < p.price && (
                              <p className="text-xs font-medium text-stone-400 line-through decoration-1">
                                ${(p.price || 0).toLocaleString("es-AR")} (P. Lista)
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 flex items-center gap-2">
                          <p className="text-lg font-black text-stone-900 tracking-tight">
                            ${Math.round((p.price || 0) * (1 - discountRate)).toLocaleString("es-AR")}
                          </p>
                          <p className="text-sm font-medium text-stone-400 line-through decoration-1">
                            ${(p.price || 0).toLocaleString("es-AR")}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 w-full border-2 border-stone-900 text-stone-900 group-hover:bg-stone-900 group-hover:text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 text-center rounded-xl transition-all duration-300">
                        Ver Anteojo
                      </div>
                    </div>
                  </Link>
                );
              })
            )}

            {displayedProducts.length === 0 && (
                <div className="col-span-full py-24 text-center">
                  <p className="text-stone-400 text-sm uppercase tracking-widest mb-4">Sin productos en esta categoría</p>
                  <button onClick={() => setActiveCategory("Todo")} className="text-xs font-bold underline">
                    Ver todo
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        {currentPage < totalPages && (
          <div className="mt-12 flex justify-center w-full">
            <button 
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={isLoading}
              className="border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-full transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Cargando..." : "Cargar más productos"}
            </button>
          </div>
        )}
        
        {displayedProducts.length > 0 && (
          <p className="mt-8 text-center text-[10px] text-stone-300 uppercase tracking-widest font-bold">
            Mostrando {displayedProducts.length} de {totalCount} {totalCount === 1 ? "modelo" : "modelos"} · Atelier Óptica
          </p>
        )}
        </div>
      </main>

      {footer}
      
    </div>
  );
}
