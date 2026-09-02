"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { PricingService } from "@/services/PricingService";
import { leerPromoCuotas } from "@/lib/promo-cuotas";
import { UMBRAL_ULTIMAS_UNIDADES } from "@/lib/constants/social-proof";

// "Contacto" y "Cristales" no tienen productos en el catálogo web: apretarlos
// devolvía una grilla vacía. Tienen su propia página, así que ahora llevan ahí.
const CATEGORIES = ["Todo", "Receta", "Sol", "Clip-On"];
const CATEGORIAS_CON_PAGINA_PROPIA: { nombre: string; href: string }[] = [
  { nombre: "Contacto", href: "/lentes-de-contacto" },
  { nombre: "Cristales", href: "/cristales-opticos" },
];

// A-05/A-15 (auditoría 2/9/26): estos banners alimentaban el hero de /tienda,
// que se sacó — era el grueso de los 1.060 px de decoración antes del primer
// anteojo, y además se servía a 1024x1024 estirado a 1800x550 (borroso). Las
// imágenes siguen en /public por si vuelven a usarse en el home, que es donde
// un hero tiene sentido; acá ya no se referencian.


// Removed duplicated isXlProduct function

/**
 * Texto alternativo de las fotos de la grilla. Antes decía marca + nombre
 * ("Cápsula Escarlata Frida C3"), que para Google Imágenes y para un lector de
 * pantalla no describe nada: repite lo que ya está escrito al lado. Con la
 * forma y el material —que ya vienen mapeados para los filtros— se arma una
 * frase que sí dice qué se está viendo.
 */
function altGrilla(p: { model?: string; category?: string | null; shape?: string; material?: string }): string {
  const tipo = p.category === 'Sol' ? 'anteojos de sol'
    : p.category === 'Clip-On' ? 'anteojos de sol clip-on'
    : 'armazón de receta';
  // "forma cuadrada", no "forma cuadrado": los valores del filtro vienen en
  // masculino porque califican al armazón, y acá califican a la forma.
  const FEMENINO: Record<string, string> = { Cuadrado: 'cuadrada', Redondo: 'redonda' };
  const forma = p.shape && p.shape !== 'Otros'
    ? (FEMENINO[p.shape] ?? p.shape.toLowerCase())
    : null;
  const rasgos = [
    p.material ? `de ${p.material.toLowerCase()}` : null,
    forma ? `forma ${forma}` : null,
  ].filter(Boolean).join(', ');
  return [`${p.model} —`, tipo, rasgos].filter(Boolean).join(' ');
}

type FiltrosUrl = {
  category: string;
  brand: string;
  shape: string;
  material: string;
  gender: string;
  sort: string;
};

// useSearchParams fuerza render en cliente hasta el <Suspense> más cercano; lo
// aislamos acá para que el resto de la tienda (h1, hero, grilla inicial) salga
// en el HTML del servidor y los filtros de la URL se apliquen al hidratar.
/** El nombre real de la categoría a partir de lo que venga en la URL. */
function canonizarCategoria(valor: string | null): string {
  const pedida = (valor || '').trim().toLowerCase();
  return CATEGORIES.find(c => c.toLowerCase() === pedida) ?? 'Todo';
}

function FiltrosDesdeUrl({ onChange }: { onChange: (filtros: FiltrosUrl) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onChange({
      // Canonizado: el link puede venir escrito de cualquier forma
      // (?categoria=sol, ?categoria=CLIP-ON). Sin esto el hero mostraba "sol"
      // en minúscula y el botón de la categoría no quedaba marcado como activo.
      category: canonizarCategoria(searchParams.get('categoria')),
      brand: searchParams.get('marca') || '',
      shape: searchParams.get('forma') || '',
      material: searchParams.get('material') || '',
      gender: searchParams.get('genero') || '',
      sort: searchParams.get('orden') || 'recientes',
    });
  }, [searchParams, onChange]);

  return null;
}

export function TiendaClient({ 
  initialCategory = 'Todo',
  initialProducts,
  initialTotalCount = 0,
  availableBrands = [],
  availableShapes = [],
  availableMaterials = [],
  footer
}: { 
  initialCategory?: string;
  initialProducts: any[];
  initialTotalCount?: number;
  availableBrands?: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);

  const [urlFilters, setUrlFilters] = useState<FiltrosUrl>({
    // Llega resuelta del servidor: si arrancara en 'Todo' y cambiara al
    // hidratar, la grilla —que se anima con key={activeCategory} en modo
    // "wait"— se quedaba mostrando el set anterior.
    category: initialCategory,
    brand: '',
    shape: '',
    material: '',
    gender: '',
    sort: 'recientes',
  });

  // La categoría vivía en un useState suelto: la grilla cambiaba pero la URL
  // seguía siendo /tienda, así que "la tienda filtrada en sol" no tenía
  // dirección — no se podía compartir por WhatsApp, ni mandar un anuncio ahí,
  // ni indexarla. Los otros cinco filtros ya viajaban en la URL (los escribe
  // ProductFilters); esta era la única excepción.
  const activeCategory = urlFilters.category;
  const setActiveCategory = (cat: string) => {
    const params = new URLSearchParams(window.location.search);
    if (cat && cat !== 'Todo') params.set('categoria', cat);
    else params.delete('categoria');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const filterBrand = urlFilters.brand;
  const filterShape = urlFilters.shape;
  const filterMaterial = urlFilters.material;
  const filterGender = urlFilters.gender;
  const sortParam = urlFilters.sort;

  // ── A-04: los filtros puestos, para mostrarlos y poder sacarlos de a uno ──
  //
  // La categoría NO entra acá: ya tiene sus propios chips arriba, donde además
  // se ve cuál está activa. Estos son los que quedaban invisibles.
  const filtrosAplicados = [
    { param: 'marca', valor: filterBrand, etiqueta: filterBrand },
    { param: 'forma', valor: filterShape, etiqueta: filterShape },
    { param: 'material', valor: filterMaterial, etiqueta: filterMaterial },
    { param: 'genero', valor: filterGender, etiqueta: filterGender },
  ].filter(f => Boolean(f.valor));

  const quitarFiltro = (param: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete(param);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /** Saca todos los filtros pero respeta la categoría y la búsqueda. */
  const limpiarTodosLosFiltros = () => {
    const params = new URLSearchParams(window.location.search);
    ['marca', 'forma', 'material', 'genero'].forEach(p => params.delete(p));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

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

    // Verificar sesión solo si hay indicios de estar logueado (user guardado o
    // cookie visible); evita un 401 por cada visitante anónimo. La cookie real
    // es httpOnly, por eso el user de localStorage es la señal principal.
    if (!stored && !document.cookie.includes('session=')) return;

    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        if (data.role === 'OPTICA') {
          setIsWholesale(true);
          localStorage.setItem('user', JSON.stringify(data));
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

  // El parseo de `web_promo_installments` vive en `promo-cuotas.ts` y en ningún
  // otro lado: estaba copiado a mano acá, en CategoryGrid y en LensConfigurator,
  // y como sacaba el número con `match(/\d+/)` sobre texto libre, escribir
  // "12 cuotas" en /admin/web hacía que esta grilla renderizara sola
  // "12 s/interés de $lista/12" — la frase prohibida, con el precio mal.
  const promo = leerPromoCuotas(webSettings.web_promo_installments);
  const installmentsCount = promo.cantidad;
  const discountRate = webSettings.web_promo_cash_discount / 100;

  // ── STATE FOR PRODUCTS & PAGINATION ──
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil((initialTotalCount || initialProducts.length) / 24) || 1);
  const [totalCount, setTotalCount] = useState(initialTotalCount || initialProducts.length);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const isRecoveringProducts = isLoading;

  // Whenever filters change, reset page to 1
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, filterBrand, filterShape, filterMaterial, filterGender, sortParam, isWholesale]);

  // Load products from API based on current filters and page.
  // El skip del fetch inicial solo vale para la PRIMERA corrida del efecto:
  // si el usuario filtra y después vuelve a "Todo" (o borra la búsqueda), el
  // estado vuelve a ser el default pero products tiene la grilla filtrada —
  // sin este ref, el early-return dejaba la pestaña "Todo" mostrando solo
  // los productos del filtro anterior.
  const isFirstEffectRunRef = useRef(true);
  useEffect(() => {
    let active = true;

    const isFirstRun = isFirstEffectRunRef.current;
    isFirstEffectRunRef.current = false;

    // Check if it's the initial server load (page 1, no filters, not wholesale)
    const isFirstRenderWithInitialData =
      currentPage === 1 &&
      activeCategory === initialCategory &&
      searchQuery === "" &&
      !filterBrand &&
      !filterShape &&
      !filterMaterial &&
      !filterGender &&
      sortParam === "recientes" &&
      !isWholesale;

    if (isFirstRun && isFirstRenderWithInitialData && products.length > 0) {
      return;
    }

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError(false);
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
        // Sin esto, al fallar el fetch quedaba la grilla del filtro ANTERIOR
        // bajo el hero del filtro nuevo, sin ningún aviso (auditoría 19/8, M2).
        if (active) setLoadError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [currentPage, activeCategory, searchQuery, filterBrand, filterShape, filterMaterial, filterGender, sortParam, isWholesale, reloadNonce]);

  const displayedProducts = products;

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <Suspense fallback={null}>
        <FiltrosDesdeUrl onChange={setUrlFilters} />
      </Suspense>
      <StorefrontNavbar theme="light" />

      {/* ── HERO BAR (TEXT) ── */}
      {/* A-05 (auditoría 2/9/26): hasta acá había 1.060 px de decoración antes
          del primer anteojo en celular — 1,3 pantallas. Este bloque solo (con
          pt-28) medía 310 px y abajo venía un hero de 350. La persona llegó a
          ver anteojos: el encabezado se achica y el contador aparece de una,
          que es el dato que orienta. */}
      <div className="pt-24 pb-5 bg-white border-b border-stone-100">
        <div className="max-w-[1600px] mx-auto px-5 flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-500 mb-1.5">
              {isWholesale ? "Cápsula Escarlata" : "Atelier Óptica"}
            </p>
            <h1 className="text-3xl md:text-5xl font-serif leading-tight">
              Tienda — Anteojos de diseño
            </h1>
            {totalCount > 0 && (
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-600">
                {totalCount} {totalCount === 1 ? "modelo" : "modelos"} · envío gratis · {webSettings.web_promo_cash_discount}% OFF transferencia
              </p>
            )}
          </div>
          <p className="hidden md:block text-sm text-stone-500 max-w-xs leading-relaxed">
            Armazones seleccionados a mano. Cada pieza elegida por diseño, calidad y carácter.
          </p>
        </div>
      </div>

      {/* ── A-05 y A-15: acá vivía un hero decorativo de 350 px en celular
             (550 en escritorio) con la palabra "Nueva Colección" encima.
             Se va, por dos razones medidas:

             A-05 — era el grueso de los 1.060 px de decoración que había que
                    pasar antes de ver el primer anteojo. Quien entra a /tienda
                    ya decidió que quiere ver anteojos; recibía en cambio una
                    imagen del tamaño de su pantalla. El lugar de un hero es el
                    home, donde todavía hay que convencer.
             A-15 — la imagen es de 1024x1024 y se mostraba a 1800x550: se
                    agrandaba un 76% (borrosa) y se recortaban dos tercios de
                    la composición.

             La categoría activa ya se lee en los chips de acá abajo, que es
             donde además se cambia. El contador y los beneficios subieron al
             encabezado. */}
      <div className="w-full">
        {/* ── BANNER DE CATEGORÍAS Y PROMOS ── */}
        <div className="bg-white border-b border-stone-100">
          <div className="max-w-[1600px] mx-auto px-5 py-4 flex flex-col xl:flex-row items-center justify-between gap-4">
            
            {/* Espacio vacío para equilibrar en desktop si fuera necesario, o promos a la izquierda */}
            <div className="hidden xl:flex flex-1 items-center gap-3">
               <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                  ENVÍO GRATIS A TODO EL PAÍS
               </span>
            </div>

            {/* Categorías (Centro) */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 min-h-11 inline-flex items-center text-[10px] md:text-[11px] font-black uppercase tracking-widest px-5 md:px-6 rounded-full transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-black text-white shadow-md scale-105"
                      : "bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-black"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {CATEGORIAS_CON_PAGINA_PROPIA.map(({ nombre, href }) => (
                <Link
                  key={nombre}
                  href={href}
                  className="shrink-0 min-h-11 inline-flex items-center text-[10px] md:text-[11px] font-black uppercase tracking-widest px-5 md:px-6 rounded-full transition-all duration-300 bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-black"
                >
                  {nombre}
                </Link>
              ))}
              {activeCategory !== "Todo" && (
                <button
                  onClick={() => setActiveCategory("Todo")}
                  className="shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold text-stone-500 hover:text-black transition-colors"
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
                 <span className="text-[10px] font-black uppercase text-red-700 bg-red-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    {discountRate * 100}% OFF TRANSFERENCIA
                 </span>
               )}
               <span className="xl:hidden text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                  ENVÍO GRATIS
               </span>
            </div>
            
          </div>
        </div>
      </div>

      {/* pb-32 en celular (A-11): el botón flotante de WhatsApp vive a 24 px
          del piso y mide 56, así que sin este colchón se come la última fila
          de la grilla y el "Cargar más". */}
      <main className="max-w-[1600px] mx-auto px-5 pt-5 md:pt-12 pb-32 md:pb-20 flex flex-col lg:flex-row gap-4 lg:gap-12 relative">
        <aside className="w-full lg:w-64 flex-shrink-0">
          {/* ProductFilters usa useSearchParams: necesita su propio Suspense para
              no arrastrar el resto de la página al render en cliente */}
          <Suspense fallback={null}>
            <ProductFilters
              availableBrands={availableBrands}
              availableShapes={availableShapes}
              availableMaterials={availableMaterials}
              /* A-04: el número vivo para el botón "Ver N modelos". */
              resultCount={totalCount}
            />
          </Suspense>
        </aside>

        <div className="flex-1">
          {/* Buscador de Productos */}
          {/* A-05: era mb-10 (40 px). Entre los chips, el botón de filtros y
              el buscador se acumulaban ~190 px de aire antes del primer
              anteojo. En celular el aire va alrededor del producto, no entre
              controles. */}
          <div className="mb-5 md:mb-10 w-full max-w-md">
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
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-2 px-2">
                Resultados para &quot;{searchQuery}&quot;: {totalCount} {totalCount === 1 ? "modelo encontrado" : "modelos encontrados"}
              </p>
            )}
          </div>

          {/* A-04 (auditoría 2/9/26): se filtraba a ciegas. Femme + aviador
              llevaba la grilla de 24 a 3 resultados sin ningún aviso en
              pantalla: no había conteo, ni forma de ver qué estaba aplicado, ni
              cómo volver atrás sin limpiar todo. Y al volver desde una ficha, la
              grilla seguía filtrada sin decirlo.

              Estos chips son la memoria visible de lo que la persona eligió, y
              cada uno se saca de a uno con la cruz. */}
          {filtrosAplicados.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">
                {totalCount} {totalCount === 1 ? "modelo" : "modelos"} ·
              </span>
              {filtrosAplicados.map((f) => (
                <button
                  key={`${f.param}-${f.valor}`}
                  onClick={() => quitarFiltro(f.param)}
                  className="group inline-flex items-center gap-1.5 min-h-9 pl-3 pr-2 rounded-full border border-stone-300 bg-white text-[11px] font-bold text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors"
                  aria-label={`Quitar el filtro ${f.etiqueta}`}
                >
                  {f.etiqueta}
                  <X className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
                </button>
              ))}
              <button
                onClick={limpiarTodosLosFiltros}
                className="min-h-9 px-3 text-[11px] font-black uppercase tracking-widest text-stone-500 underline underline-offset-4 hover:text-stone-900 transition-colors"
              >
                Limpiar todo
              </button>
            </div>
          )}

          {/* The skeleton is no longer needed since data is preloaded */}
          {/* initial={false}: la grilla ya viaja en el HTML del servidor, no ocultarla */}
          {/* Sin `mode="wait"` ni `key`: con los dos, al cambiar de categoría el
              bloque viejo tenía que terminar su animación de salida antes de
              montar el nuevo, y en la práctica no la terminaba nunca — la
              grilla quedaba congelada en la categoría anterior aunque el fetch
              ya hubiera traído los productos correctos. Apretar "Sol" o
              "Clip-On" no cambiaba nada en pantalla. La transición ahora la
              hace el propio contenedor, sin desmontarlo. */}
          <AnimatePresence initial={false}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14"
            >
              {loadError ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                  <p className="text-xl font-serif text-stone-900 mb-2">No pudimos cargar los productos</p>
                  <p className="text-stone-500 mb-6 max-w-md mx-auto">Puede ser un problema momentáneo de conexión. Probá de nuevo.</p>
                  <button
                    onClick={() => { setLoadError(false); setCurrentPage(1); setReloadNonce((n) => n + 1); }}
                    className="bg-black text-white px-8 py-3 text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : displayedProducts.length === 0 ? (
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
                    <div className="bg-white aspect-square overflow-hidden mb-4 relative">
                      {/* Contenedor de imágenes con efecto zoom */}
                      <div className="absolute inset-0 transition-transform duration-700 ease-out md:group-hover:scale-110">
                        {imgUrl ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Image unoptimized={String(imgUrl).startsWith('data:')}
                              src={imgUrl}
                              alt={altGrilla(p)}
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
                          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-stone-600">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                            <span className="text-[9px] uppercase tracking-widest">Sin foto</span>
                          </div>
                        )}

                        {hasSecondImage && secondImgUrl && (
                          <Image unoptimized={String(secondImgUrl).startsWith('data:')}
                            src={secondImgUrl}
                            alt={`${altGrilla(p)} — puestos`}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                            className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out"
                          />
                        )}
                      </div>

                      {/* Badge categoría */}
                      {p.category && (
                        <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest bg-white/80 backdrop-blur-sm px-2 py-1 z-10">
                          {p.shape === "XL" ? `${p.category} · XL` : p.category}
                        </span>
                      )}

                      {/* Escasez REAL: el mismo stock (y el mismo umbral) que la
                          ficha ya anuncia como "¡Últimas N u.!", ahora visible
                          desde la grilla. Solo stock verdadero de la base —
                          nunca un contador inventado. */}
                      {!isWholesale && typeof p.stock === 'number' && p.stock > 0 && p.stock <= UMBRAL_ULTIMAS_UNIDADES && (
                        <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-1 z-10 rounded-sm shadow-sm">
                          ¡Últimas {p.stock} u.!
                        </span>
                      )}

                      {/* Titanium Badge */}
                      {p.material === "Titanio" && (
                        <span className="absolute bottom-3 left-3 text-[10px] font-black uppercase tracking-[0.18em] bg-stone-900/90 text-stone-100 backdrop-blur-sm px-2.5 py-1 z-10 border border-stone-800 shadow-md flex items-center gap-1.5 rounded-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Titanio
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-col gap-1 mt-4 px-1 pb-4">
                      <div className="flex items-center justify-between mb-0.5">
                        {/* La marca es un <p>, no un encabezado: iba como <h3>
                            ANTES del <h2> del nombre, así que cada tarjeta
                            invertía la jerarquía del listado. */}
                        <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.20em]">{isWholesale ? 'Cápsula Escarlata' : (p.brand || 'ATELIER')}</p>
                        {p.material === "Titanio" && (
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                            Titanio
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-serif tracking-tight text-black leading-tight mb-3 group-hover:text-stone-600 transition-colors">
                        {p.name || p.model}
                      </h2>
                      
                      {isWholesale ? (
                        <div className="pt-3 flex flex-col gap-1">
                          {/* Sin wholesalePrice cargado (> 0) el backend cobra retail:
                              no etiquetar el precio de lista como "Mayorista". */}
                          {p.wholesalePrice > 0 ? (
                            <>
                              <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max">
                                Precio Mayorista
                              </span>
                              <div className="flex items-center gap-2 animate-in fade-in">
                                <p className="text-lg font-black text-blue-600 tracking-tight">
                                  ${(p.wholesalePrice || 0).toLocaleString("es-AR")}
                                </p>
                                {p.wholesalePrice < p.price && (
                                  <p className="text-xs font-medium text-stone-500 line-through decoration-1">
                                    ${(p.price || 0).toLocaleString("es-AR")} (P. Lista)
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 animate-in fade-in">
                              <p className="text-lg font-black text-stone-900 tracking-tight">
                                ${(p.price || 0).toLocaleString("es-AR")}
                              </p>
                              <span className="text-[9px] font-medium uppercase text-stone-400">
                                P. Lista
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (() => {
                        // Precio idéntico al del home: siempre sobre el precio de lista
                        // (price), nunca salePrice, para que un mismo producto muestre el
                        // mismo valor (cuotas + eft/transf) en la home y en la tienda.
                        const base = (p.price || 0);

                        // ¿Está REALMENTE en oferta? Es lo único que se grita.
                        //
                        // Antes las 114 tarjetas llevaban el mismo cartel verde
                        // "15% OFF 🔥". Ese 15% es cierto, pero es una CONDICIÓN
                        // DE PAGO (efectivo o transferencia), no una oferta: no
                        // depende del producto y está en todos por igual. Con el
                        // mismo cartel en todas, el ojo lo deja de ver a la
                        // tercera tarjeta — y, peor, quemaba el único lugar
                        // donde una oferta de verdad podía gritarse. La tarjeta
                        // ni siquiera miraba `salePrice`: un producto rebajado
                        // se veía igual que uno que no.
                        // Ahora el cartel llamativo es exclusivo de la rebaja
                        // real, y el 15% se dice donde corresponde: al lado del
                        // precio de contado, como la condición que es.
                        const oferta = (p.salePrice || 0) > 0 && p.salePrice < base;
                        const ahorro = oferta ? Math.round((1 - p.salePrice / base) * 100) : 0;

                        return (
                          <div className="pt-1 flex items-center justify-between gap-2">
                            {/* El valor GRANDE es el de transferencia (pedido
                                de Ishtar, 31/8): es el precio que decide la
                                compra. Las cuotas quedan como segunda línea —
                                las 12 se dicen "fijas", sin el % (decisión de
                                Ishtar, 31/8 noche). Los valores salen de
                                PricingService, con el recargo adentro. */}
                            <p className="text-sm text-stone-600 font-medium">
                              <span className="font-black text-base text-stone-900">
                                ${Math.round((oferta ? p.salePrice : base) * (1 - (webSettings.web_promo_cash_discount || 15) / 100)).toLocaleString("es-AR")}
                              </span>
                              <span className="text-emerald-700 text-xs font-bold"> {webSettings.web_promo_cash_discount}% OFF transf.</span>
                              <span className="block text-xs text-stone-500">
                                12 cuotas fijas de ${PricingService.cuotasMpLargas(oferta ? p.salePrice : base).installment12.toLocaleString("es-AR")} · {installmentsCount} s/interés de ${Math.round((oferta ? p.salePrice : base) / installmentsCount).toLocaleString("es-AR")}
                              </span>
                            </p>
                            {oferta && (
                              <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-sm whitespace-nowrap shrink-0">
                                {ahorro}% OFF 🔥
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <div className="mt-4 w-full border border-stone-300 text-stone-900 group-hover:border-stone-900 group-hover:bg-stone-900 group-hover:text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 text-center rounded-xl transition-all duration-300">
                        Ver Modelo
                      </div>
                    </div>
                  </Link>
                );
              })
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
          <p className="mt-8 text-center text-[10px] text-stone-600 uppercase tracking-widest font-bold">
            Mostrando {displayedProducts.length} de {totalCount} {totalCount === 1 ? "modelo" : "modelos"} · {isWholesale ? "Cápsula Escarlata" : "Atelier Óptica"}
          </p>
        )}
        </div>
      </main>

      {/* Prueba social: reseñas reales de Google en la vitrina principal */}
      <GoogleReviews />

      {footer}

    </div>
  );
}
