"use client";

import { useState, useEffect, useRef, useTransition, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { ProductFilters } from "@/components/Storefront/ProductFilters";
import { familiaColorPorId } from "@/lib/catalog/color-normalizado";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { usePromo2x1 } from "@/hooks/usePromo2x1";
import { PricingService } from "@/services/PricingService";
import { leerPromoCuotas } from "@/lib/promo-cuotas";
import { UMBRAL_ULTIMAS_UNIDADES } from "@/lib/constants/social-proof";
import { track } from "@/lib/client-analytics";

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
  /** Familia de color (?color=negro). Un armazón puede pertenecer a más de
   *  una — ver color-normalizado.ts. */
  color: string;
  sort: string;
  /** A-08: rango de precio. Van juntos y pueden estar vacíos los dos. */
  precioMin: string;
  precioMax: string;
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
      color: searchParams.get('color') || '',
      sort: searchParams.get('orden') || 'recientes',
      precioMin: searchParams.get('precioMin') || '',
      precioMax: searchParams.get('precioMax') || '',
    });
  }, [searchParams, onChange]);

  return null;
}

export function TiendaClient({ 
  initialCategory = 'Todo',
  initialProducts,
  initialTotalCount = 0,
  initialConteos = null,
  availableBrands = [],
  availableShapes = [],
  availableMaterials = [],
  availableColors = [],
  footer
}: { 
  initialCategory?: string;
  initialProducts: any[];
  initialTotalCount?: number;
  /** F1-02: conteos por opción para el primer pintado (ver tienda/page.tsx). */
  initialConteos?: { marca: Record<string, number>; forma: Record<string, number>; material: Record<string, number>; color?: Record<string, number> } | null;
  availableBrands?: string[];
  availableShapes?: string[];
  availableMaterials?: string[];
  availableColors?: string[];
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  // R6: ver el comentario en ProductFilters. Los chips de categoría y los de
  // filtro aplicado escriben la misma URL y tienen que comportarse igual.
  const [, startTransition] = useTransition();
  const navegarAFiltro = (url: string) => {
    startTransition(() => router.replace(url, { scroll: false }));
  };
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
    color: '',
    sort: 'recientes',
    precioMin: '',
    precioMax: '',
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
    navegarAFiltro(qs ? `${pathname}?${qs}` : pathname);
  };

  const filterBrand = urlFilters.brand;
  const filterShape = urlFilters.shape;
  const filterMaterial = urlFilters.material;
  const filterGender = urlFilters.gender;
  const filterColor = urlFilters.color;
  const sortParam = urlFilters.sort;
  const filterPrecioMin = urlFilters.precioMin;
  const filterPrecioMax = urlFilters.precioMax;

  // ── F1-08 / Anexo C: `view_item_list` ────────────────────────────────────
  //
  // Se dispara cuando la grilla termina de pintar un set nuevo. Es el evento
  // que abre el embudo: sin él no se puede calcular "de cada 100 que ven la
  // grilla, cuántas abren una ficha", que es la métrica principal de las tres
  // pruebas A/B del plan.
  //
  // Va con los filtros puestos adentro, porque la pregunta útil no es cuánta
  // gente vio la grilla sino cuánta vio una grilla YA filtrada — que es la que
  // el rediseño del panel quiere mover.
  const listaReportada = useRef<string>('');
  /**
   * Firma de los filtros cuyo fetch YA terminó. Sin esto, el evento se
   * disparaba con el `totalCount` viejo: en /tienda?genero=Femme&material=Acetato
   * reportaba 106 cuando el resultado real eran 45. Un embudo con el
   * denominador equivocado es peor que no tener embudo.
   */
  const filtrosDelUltimoFetch = useRef<string>('');

  // ── A-04: los filtros puestos, para mostrarlos y poder sacarlos de a uno ──
  //
  // La categoría NO entra acá: ya tiene sus propios chips arriba, donde además
  // se ve cuál está activa. Estos son los que quedaban invisibles.
  const filtrosAplicados = [
    { param: 'marca', valor: filterBrand, etiqueta: filterBrand },
    { param: 'forma', valor: filterShape, etiqueta: filterShape },
    { param: 'material', valor: filterMaterial, etiqueta: filterMaterial },
    { param: 'genero', valor: filterGender, etiqueta: filterGender },
    { param: 'color', valor: filterColor, etiqueta: familiaColorPorId(filterColor)?.etiqueta || filterColor },
    // A-08: el rango de precio son dos parámetros pero UN chip, con la
    // etiqueta escrita como la lee una persona. Al quitarlo se van los dos.
    {
      param: 'precio',
      valor: filterPrecioMin || filterPrecioMax,
      etiqueta: filterPrecioMin && filterPrecioMax
        ? `$${Number(filterPrecioMin).toLocaleString('es-AR')} a $${Number(filterPrecioMax).toLocaleString('es-AR')}`
        : filterPrecioMax
          ? `Hasta $${Number(filterPrecioMax).toLocaleString('es-AR')}`
          : `Más de $${Number(filterPrecioMin).toLocaleString('es-AR')}`,
    },
  ].filter(f => Boolean(f.valor));

  const quitarFiltro = (param: string) => {
    const params = new URLSearchParams(window.location.search);
    if (param === 'precio') {
      params.delete('precioMin');
      params.delete('precioMax');
    } else {
      params.delete(param);
    }
    const qs = params.toString();
    navegarAFiltro(qs ? `${pathname}?${qs}` : pathname);
  };

  /** Saca todos los filtros pero respeta la categoría y la búsqueda. */
  const limpiarTodosLosFiltros = () => {
    const params = new URLSearchParams(window.location.search);
    ['marca', 'forma', 'material', 'genero', 'color', 'precioMin', 'precioMax'].forEach(p => params.delete(p));
    const qs = params.toString();
    navegarAFiltro(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    setVisibleCount(24);
  }, [activeCategory, searchQuery, filterGender]);

  // F1-02: cuántos modelos hay detrás de cada opción de cada faceta. Los
  // calcula el endpoint contra los OTROS filtros activos (ver el comentario en
  // api/store/products), así que acá solo se transportan a ProductFilters.
  const [conteos, setConteos] = useState<{ marca: Record<string, number>; forma: Record<string, number>; material: Record<string, number>; color?: Record<string, number> } | null>(initialConteos);

  const [isWholesale, setIsWholesale] = useState(false);
  const { activa: promo2x1Activa, ids: idsPromo2x1 } = usePromo2x1();
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
  // (El descuento se muestra como % en el encabezado y en cada card; acá ya no
  //  hace falta la tasa suelta desde que se fue el chip de promo — A-25.)

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
      !filterColor &&
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
        if (filterColor) queryParams.set('color', filterColor);
        if (filterPrecioMin) queryParams.set('precioMin', filterPrecioMin);
        if (filterPrecioMax) queryParams.set('precioMax', filterPrecioMax);
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
          setConteos(data.conteos || null);
          filtrosDelUltimoFetch.current = [activeCategory, filterBrand, filterShape,
            filterMaterial, filterGender, filterColor, filterPrecioMin, filterPrecioMax,
            sortParam, searchQuery, currentPage].join('|');
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
  }, [currentPage, activeCategory, searchQuery, filterBrand, filterShape, filterMaterial, filterGender, filterColor, filterPrecioMin, filterPrecioMax, sortParam, isWholesale, reloadNonce]);

  const displayedProducts = products;

  useEffect(() => {
    if (!displayedProducts.length) return;
    // No reportar hasta que los datos terminaron de llegar: si no, el conteo
    // que viaja en el evento es el del set anterior.
    if (isLoading) return;
    // Y no reportar mientras el estado todavía no refleja la URL.
    //
    // Quien entra por un link filtrado —o sea, cualquiera que venga de un
    // anuncio o de un link compartido por WhatsApp— pasa por dos renders: el
    // del servidor, sin filtros, y el del cliente cuando lee la URL. Sin esta
    // guarda se reportaban DOS vistas de lista por una sola visita, y la
    // primera con los filtros vacíos: el denominador del embudo quedaba
    // inflado justo en el tráfico pago, que es el que se quiere medir.
    const enUrl = new URLSearchParams(window.location.search);
    const coincide = (param: string, valor: string) => (enUrl.get(param) || '') === valor;
    if (!coincide('marca', filterBrand) || !coincide('forma', filterShape)
      || !coincide('material', filterMaterial) || !coincide('genero', filterGender)
      || !coincide('color', filterColor)
      || !coincide('precioMin', filterPrecioMin) || !coincide('precioMax', filterPrecioMax)) {
      return;
    }
    // Una "lista" es la combinación de filtros + página. Se reporta una sola
    // vez por combinación: sin esta guarda, cada re-render (y son muchos: el
    // panel, el contador, el hover de una card) mandaría el evento de nuevo y
    // el denominador del embudo quedaría inflado.
    const clave = [activeCategory, filterBrand, filterShape, filterMaterial,
      filterGender, filterColor, filterPrecioMin, filterPrecioMax, sortParam, searchQuery,
      currentPage].join('|');
    if (listaReportada.current === clave) return;
    // El conteo que viaja en el evento tiene que ser el de ESTOS filtros. Si el
    // último fetch fue por otra combinación, `totalCount` todavía es el viejo:
    // se espera. La excepción es la primera carga sin filtros, donde el
    // servidor ya mandó el número correcto y no hay fetch que esperar.
    const hayFiltros = clave.split('|').slice(0, 8).some(Boolean);
    if (hayFiltros && filtrosDelUltimoFetch.current !== clave) return;
    listaReportada.current = clave;

    track('view_item_list', {
      meta: {
        list_id: activeCategory.toLowerCase(),
        filters_applied: filtrosAplicados.map(f => `${f.param}:${f.valor}`),
        results_count: totalCount,
        page: currentPage,
      },
    });
  }, [displayedProducts.length, isLoading, activeCategory, filterBrand, filterShape,
      filterMaterial, filterGender, filterColor, filterPrecioMin, filterPrecioMax,
      sortParam, searchQuery, currentPage, totalCount, filtrosAplicados]);


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
            {/* R7 del plan: todo cambio de estado se anuncia. Sin aria-live,
                quien usa lector de pantalla filtra y no se entera de que el
                número cambió — el filtro queda mudo justo para quien más
                necesita el aviso. "polite" y no "assertive": no interrumpe lo
                que se esté leyendo, avisa cuando termina. */}
            {totalCount > 0 && (
              <p
                aria-live="polite"
                className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-600"
              >
                {totalCount} {totalCount === 1 ? "modelo" : "modelos"} · envío gratis · {webSettings.web_promo_cash_discount}% OFF transferencia
              </p>
            )}
          </div>
          <p className="hidden md:block text-sm text-stone-500 max-w-xs leading-relaxed">
            Armazones seleccionados a mano. Cada pieza elegida por diseño, calidad y carácter.
          </p>
        </div>

        {/* ── La placa del 2x1 ────────────────────────────────────────────────
            Solo aparece con la promo prendida en /admin/web; apagada, la tienda
            queda exactamente como estaba.

            Va acá y no arriba de todo a propósito: arriba está la barra de
            anuncios, que rota entre cuotas, 15% y envío. Un 2x1 que regala un
            armazón no puede entrar en una rotación donde le toca un tercio del
            tiempo — necesita un lugar fijo, y este es el primero que se ve
            después del título, antes del primer anteojo.

            Negra con dorado, como la placa del carrusel: es la misma familia de
            "esto es lo importante". El dorado sobre negro es `--dorado`, el que
            la tabla de contraste de globals.css marca para fondo oscuro. */}
        {promo2x1Activa && !isWholesale && (
          <div className="mt-4 relative overflow-hidden rounded-2xl bg-stone-950 px-5 py-4 sm:px-8 sm:py-7">
            <div
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--dorado)]/20 blur-[70px] pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--dorado)]">
                  Promo del mes
                </p>
                <p className="mt-1 text-2xl sm:text-4xl font-serif tracking-tight text-white">
                  2x1 en armazones seleccionados
                </p>
                {/* "Seleccionados" va en el TÍTULO, no en la letra chica: la promo
                    entra solo en los armazones marcados en /admin/web, y decir
                    "2x1 en armazones" a secas promete el catálogo entero — que es
                    justo lo que el carrito no va a cumplir. Y se dice cómo
                    reconocerlos, porque si no hay que adivinar cuáles son. */}
                <p className="mt-1.5 text-[13px] sm:text-sm text-stone-300 leading-snug sm:leading-relaxed max-w-md">
                  Llevate dos y pagá uno: el más barato va{" "}
                  <span className="font-bold text-white">sin cargo</span>. Los que entran llevan el sello{" "}
                  <span className="font-black text-[var(--dorado)]">2x1</span> sobre la foto.
                </p>
              </div>
              {/* Un <a> de verdad, no un <span> con forma de botón. Ya estamos
                  en /tienda, así que baja a la grilla en vez de navegar: la
                  placa está arriba de todo y sin esto el llamado no llevaba a
                  ningún lado — parecía un botón roto. */}
              <a
                href="#grilla"
                className="shrink-0 self-start sm:self-auto inline-flex items-center gap-2 rounded-full bg-[var(--dorado)] px-5 py-2.5 sm:py-3 min-h-11 text-[11px] font-black uppercase tracking-widest text-stone-950 transition-transform duration-300 hover:scale-105"
              >
                Elegí los dos
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        )}
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
              {/* A-25: Contacto y Cristales NO filtran esta grilla — se van a
                  otra página. Tenían la misma píldora rellena que las
                  categorías, así que se leían como un filtro más y el cambio de
                  página era una sorpresa. Ahora son de contorno y llevan la
                  flechita: la forma dice "esto te lleva a otro lado". */}
              {CATEGORIAS_CON_PAGINA_PROPIA.map(({ nombre, href }) => (
                <Link
                  key={nombre}
                  href={href}
                  className="shrink-0 min-h-11 inline-flex items-center gap-1.5 text-[10px] md:text-[11px] font-black uppercase tracking-widest px-5 md:px-6 rounded-full border border-stone-300 text-stone-600 hover:border-stone-900 hover:text-black transition-all duration-300"
                >
                  {nombre}
                  <span aria-hidden className="text-stone-400">→</span>
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

            {/* A-25 (auditoría 2/9/26): acá había dos chips de promo ("15% OFF
                transferencia" y "envío gratis") con exactamente la misma forma
                que los chips de categoría. Tres cosas distintas —filtros,
                servicios y promociones— con una sola forma: todo parecía
                clickeable y todo parecía filtrar. Las promos ya viven en el
                encabezado como texto (A-05), que es donde no se confunden con
                un botón. Lo único que queda es el aviso de sesión mayorista,
                que no es una promo: es el estado en el que está la persona. */}
            {isWholesale && (
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full whitespace-nowrap">
                Tarifa Mayorista Activa
              </span>
            )}
            
          </div>
        </div>
      </div>

      {/* pb-32 en celular (A-11): el botón flotante de WhatsApp vive a 24 px
          del piso y mide 56, así que sin este colchón se come la última fila
          de la grilla y el "Cargar más". */}
      <main className="max-w-[1600px] mx-auto px-5 pt-5 md:pt-12 pb-32 md:pb-20 flex flex-col lg:flex-row gap-4 lg:gap-12 relative">
        {/* A-09 (auditoría 2/9/26): la columna de filtros medía 3.609 px y no
            quedaba fija, así que refinar una búsqueda en escritorio obligaba a
            volver hasta arriba en cada iteración. Ahora se ancla debajo del
            header (80 px) con scroll propio: los filtros quedan a la vista
            mientras se recorre la grilla. */}
        <aside className="w-full lg:w-64 flex-shrink-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {/* ProductFilters usa useSearchParams: necesita su propio Suspense para
              no arrastrar el resto de la página al render en cliente */}
          <Suspense fallback={null}>
            <ProductFilters
              availableBrands={availableBrands}
              availableShapes={availableShapes}
              availableMaterials={availableMaterials}
              availableColors={availableColors}
              /* A-04: el número vivo para el botón "Ver N modelos". */
              resultCount={totalCount}
              /* F1-02: cuántos modelos hay detrás de cada opción. */
              conteos={conteos}
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
              <span aria-live="polite" className="text-[10px] font-black uppercase tracking-widest text-stone-500">
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
              id="grilla"
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8 md:gap-y-14"
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
                    {/* A-28 (auditoría 2/9/26): antes esto era un cartel sin
                        salida —"Intentá ajustar los filtros"— que dejaba a la
                        persona sola frente a un panel de filtros que ella misma
                        no sabía cómo había quedado. Dos filtros ya dejan 3
                        resultados, así que llegar a cero es cuestión de tiempo.
                        Ahora se nombra el filtro culpable y se saca de un
                        toque. */}
                    <p className="text-xl font-serif text-stone-900 mb-2">No encontramos resultados</p>
                    {filtrosAplicados.length > 0 ? (
                      <>
                        <p className="text-stone-500 mb-5 max-w-md mx-auto">
                          Ningún modelo cumple con {filtrosAplicados.length === 1 ? 'el filtro' : 'los filtros'}{' '}
                          {filtrosAplicados.map(f => f.etiqueta).join(' + ')}
                          {searchQuery ? <> y la búsqueda «{searchQuery}»</> : null}.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 mb-6">
                          {filtrosAplicados.map(f => (
                            <button
                              key={`vacio-${f.param}`}
                              onClick={() => quitarFiltro(f.param)}
                              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-stone-300 bg-white text-[11px] font-bold text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors"
                            >
                              Quitar «{f.etiqueta}»
                              <X className="w-3.5 h-3.5 text-stone-400" />
                            </button>
                          ))}
                          <button
                            onClick={limpiarTodosLosFiltros}
                            className="min-h-11 px-5 rounded-full bg-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors"
                          >
                            Quitar todos los filtros
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-stone-500 mb-6 max-w-md mx-auto">
                          {searchQuery
                            ? <>No hay modelos que coincidan con «{searchQuery}». Probá con el nombre del modelo o la marca.</>
                            : <>Esta categoría no tiene modelos cargados por ahora.</>}
                        </p>
                        <Link href="/tienda" className="inline-flex items-center min-h-11 bg-black text-white px-8 text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full">
                          Ver toda la colección
                        </Link>
                      </>
                    )}
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

                      {/* Sello 2x1. Abajo a la derecha: arriba a la izquierda
                          está la categoría, arriba a la derecha "últimas N u." y
                          abajo a la izquierda "Titanio". Es la única esquina
                          libre, y así ningún sello tapa a otro. */}
                      {promo2x1Activa && !isWholesale && idsPromo2x1.has(p.id) && (
                        <span
                          title="Este armazón entra en el 2x1: llevando dos, el más barato va sin cargo"
                          className="absolute bottom-3 right-3 text-[10px] font-black uppercase tracking-[0.15em] bg-stone-950 text-[var(--dorado)] px-2.5 py-1 z-10 rounded-sm shadow-md"
                        >
                          2x1
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
                    {/* A-21 (auditoría 2/9/26): la card medía 156x419 px, o sea
                        que una fila se comía el 60% de la pantalla y nunca
                        entraban dos. Elegir anteojos es COMPARAR formas, y así no
                        se podían comparar. El aire de acá se ajusta en celular. */}
                    <div className="flex flex-col gap-1 mt-2.5 md:mt-4 px-1 pb-2 md:pb-4">
                      <div className="flex items-center justify-between mb-0.5">
                        {/* La marca es un <p>, no un encabezado: iba como <h3>
                            ANTES del <h2> del nombre, así que cada tarjeta
                            invertía la jerarquía del listado. */}
                        <p className="text-[10px] text-stone-500 font-black uppercase tracking-[0.20em]">{isWholesale ? 'Cápsula Escarlata' : (p.brand || 'ATELIER')}</p>
                        {/* Acá había un segundo chip "Titanio". La misma tarjeta
                            ya lo dice sobre la foto, abajo a la izquierda, y el
                            lector de pantalla leía "Titanio Atelier Titanio".
                            Un dato repetido no informa dos veces: ocupa lugar. */}
                      </div>
                      <h2 className="text-base md:text-2xl font-serif tracking-tight text-black leading-tight mb-1.5 md:mb-3 group-hover:text-stone-600 transition-colors">
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
                              {/* El 15% va en el MISMO renglón que el precio
                                  (pedido de Ishtar, 5/9). */}
                              <span className="text-emerald-700 text-xs font-bold"> {webSettings.web_promo_cash_discount}% OFF transf.</span>
                              {/* Las cuotas van SIEMPRE —también en celular— y
                                  UNA DEBAJO DE LA OTRA, no separadas por un "·"
                                  en el mismo renglón (pedido de Ishtar, 5/9:
                                  "primero uno después el otro"). El 2/9 se habían
                                  ocultado en celular para que la tarjeta respirara;
                                  se revierte: el valor de la cuota es parte de lo
                                  que decide la compra y tiene que verse en la
                                  grilla, no solo en la ficha.
                                  "fijas" se mantiene: es la palabra que distingue
                                  las 12 (que llevan el costo financiero del 10%)
                                  de las 3 y 6, que sí son sin interés — regla de
                                  CLAUDE.md. Los importes salen de PricingService. */}
                              <span className="block text-xs text-stone-500">
                                12 cuotas fijas de ${PricingService.cuotasMpLargas(oferta ? p.salePrice : base).installment12.toLocaleString("es-AR")}
                              </span>
                              <span className="block text-xs text-stone-500">
                                {installmentsCount} cuotas sin interés de ${Math.round((oferta ? p.salePrice : base) / installmentsCount).toLocaleString("es-AR")}
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

                      <div className="hidden md:block mt-4 w-full border border-stone-300 text-stone-900 group-hover:border-stone-900 group-hover:bg-stone-900 group-hover:text-white text-[11px] font-black uppercase tracking-[0.2em] py-3 text-center rounded-xl transition-all duration-300">
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
              onClick={() => {
                // F1-08 / Anexo C: cuántas veces la gente pide más. Si el
                // número es alto, el problema no es la paginación: es que los
                // filtros no la están llevando a lo que busca.
                track('load_more', { meta: { page: currentPage + 1, items_loaded: displayedProducts.length } });
                setCurrentPage(p => p + 1);
              }}
              disabled={isLoading}
              className="border-2 border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-full transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* A-27: el botón no decía cuánto faltaba. "Cargar más" cinco
                  veces seguidas, sin ningún número que oriente, es no saber si
                  quedan tres modelos o setenta. */}
              {isLoading
                ? "Cargando..."
                : `Cargar más — mostrando ${displayedProducts.length} de ${totalCount}`}
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
