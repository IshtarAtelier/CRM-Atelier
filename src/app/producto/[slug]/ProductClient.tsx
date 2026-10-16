"use client";
import Image from "next/image";
import Link from "next/link";
import { WHATSAPP_PHONE, WHOLESALE_WHATSAPP_PHONE } from "@/lib/constants";
import { buildWhatsAppUrl, currentPageUrl } from "@/lib/whatsapp-link";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Share2, ChevronDown, Truck, Package, ShieldCheck, CreditCard, Percent, Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { trackViewContent } from "@/lib/tracking";
import { GARANTIA_ADAPTACION, fichaMuestraGarantiaDeAdaptacion } from "@/lib/garantia";
import { PricingService } from "@/services/PricingService";
import { queIncluye, PLAZOS_DESPACHO } from "@/lib/ficha/que-incluye";
import { formatearPrecio, precioConSigno } from "@/lib/format-precio";
import { anteojoCompletoDesde } from "@/lib/anteojo-completo";
import { useOpcionesCristal } from "@/hooks/useOpcionesCristal";
import { leerPromoCuotas, textoCuotas12, LINEA_CUOTAS } from "@/lib/promo-cuotas";
import { descuentoTransferenciaDe } from "@/lib/catalog/rango-precio";
import { precioConOferta } from "@/lib/precio-oferta";
import { promoVisible } from "@/lib/promo-visible";
import { UMBRAL_ULTIMAS_UNIDADES, textoUltimasUnidades, claveMarca, claveModelo } from "@/lib/constants/social-proof";
import { TrustStrip } from "@/components/Storefront/TrustStrip";
import ProductReviews from "@/components/Storefront/ProductReviews";
import { GaleriaZoom } from "./GaleriaZoom";

// Carga diferida: el configurador (662 líneas) recién se monta cuando el cliente
// abre el modal, y el diagrama vive dentro de un acordeón colapsado. Sacarlos del
// bundle inicial reduce el Total Blocking Time de la página de producto.
const LensConfigurator = dynamic(
  () => import("@/components/Storefront/LensConfigurator").then((mod) => mod.LensConfigurator),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <span aria-hidden="true" className="w-8 h-8 rounded-full border-2 border-[#c8a55c]/25 border-t-[#c8a55c] animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-500">Cargando configurador…</p>
      </div>
    ),
  }
);

const GlassesDiagram = dynamic(
  () => import("@/components/Storefront/GlassesDiagram").then((mod) => mod.GlassesDiagram),
  {
    ssr: false,
    loading: () => (
      // Esqueleto con el mismo footprint que la barra colapsada "Medidas y Calce"
      <div className="w-full pt-8 pb-4">
        <div className="w-full flex justify-between items-center border-b border-[#e5e5e5] pb-4">
          <span aria-hidden="true" className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
          <span className="text-xl font-light text-stone-300">+</span>
        </div>
      </div>
    ),
  }
);

export function ProductClient({
  product, 
  variants = [], 
  similarProducts,
  footer 
}: { 
  product: any; 
  variants?: any[]; 
  similarProducts: any[];
  footer?: React.ReactNode;
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Fase 1.7 (15/10/2026): tap sobre la foto abre el lightbox con zoom
  // (GaleriaZoom.tsx). Antes tap y doble tap no hacían nada.
  const [zoomAbierto, setZoomAbierto] = useState(false);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  // ── A-16 (auditoría 2/9/26): la barra de compra fija en celular ───────────
  //
  // Los CTA viven solo arriba. La persona baja a leer las medidas del armazón,
  // se convence de que le va a calzar... y en ese momento no tiene ningún botón
  // cerca: tiene que volver a subir. La barra aparece cuando los botones de
  // arriba salen de pantalla y desaparece cuando vuelven, así que nunca hay dos
  // llamados compitiendo (A-12).
  const ctaPrincipalRef = useRef<HTMLDivElement>(null);
  const [ctaFueraDeVista, setCtaFueraDeVista] = useState(false);

  useEffect(() => {
    const nodo = ctaPrincipalRef.current;
    if (!nodo) return;
    const io = new IntersectionObserver(
      ([entrada]) => setCtaFueraDeVista(!entrada.isIntersecting),
      // rootMargin negativo abajo: la barra aparece cuando el botón ya salió
      // de verdad, no cuando le falta un píxel.
      { rootMargin: '0px 0px -80px 0px' }
    );
    io.observe(nodo);
    return () => io.disconnect();
  }, []);

  // ── F2-01: el configurador como diálogo accesible de verdad ───────────────
  //
  // El plan lo marca OBLIGATORIO y no estaba nada: sin rol de diálogo, sin
  // trampa de foco, sin Esc, y con el fondo scrolleando detrás. Quien navega
  // con teclado abría el modal y el foco se quedaba atrás, en la página —
  // tabulaba "adentro" de un modal en el que nunca había entrado.
  const modalRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showConfigurator) return;

    // De dónde vino el foco, para devolverlo al cerrar.
    disparadorRef.current = document.activeElement as HTMLElement | null;

    // El fondo no scrollea mientras el modal está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const enfocables = () => Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter(el => el.offsetParent !== null);

    // El foco entra al modal, en el primer control real.
    const t = setTimeout(() => enfocables()[0]?.focus(), 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowConfigurator(false);
        return;
      }
      if (e.key !== 'Tab') return;
      // Trampa de foco: el Tab da la vuelta adentro del modal.
      const lista = enfocables();
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflowPrevio;
      // El foco vuelve al botón que lo abrió, no al principio de la página.
      disparadorRef.current?.focus?.();
    };
  }, [showConfigurator]);
  
  // E-commerce states
  const [activeAccordion, setActiveAccordion] = useState<string | null>("description");
  const [zipCode, setZipCode] = useState("");
  const [shippingResult, setShippingResult] = useState<string | null>(null);

  const { addItem, setIsOpen } = useCart();

  const [isWholesale, setIsWholesale] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === 'OPTICA') {
          setIsWholesale(true);
          setCurrentUser(u);
        }
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
          setCurrentUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        } else {
          setIsWholesale(false);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        setIsWholesale(false);
        setCurrentUser(null);
      });
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error("Error loading settings in product client:", err));
  }, []);

  // Prueba social REAL: clientes distintos que compraron este producto (o su
  // marca). El endpoint ya viene filtrado por umbral desde la base — si acá no
  // llega el número, el cartel no existe. Nunca se inventa (Ley 24.240).
  const [socialProof, setSocialProof] = useState<{ productos: Record<string, number>; modelos: Record<string, number>; marcas: Record<string, number> } | null>(null);
  useEffect(() => {
    fetch('/api/store/social-proof')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setSocialProof(data); })
      .catch(() => {});
  }, []);
  const clientesDelProducto = socialProof?.productos?.[product.id] || 0;
  const clientesDelModelo = socialProof?.modelos?.[claveModelo(product.modelCode)] || 0;
  const clientesDeLaMarca = socialProof?.marcas?.[claveMarca(product.brand)] || 0;

  // Precios netos: la ficha es ISR y el HTML lo comparten todos, así que el
  // server ya no los manda (llegan siempre en 0). Los pedimos acá solo cuando
  // hay sesión de óptica; el endpoint exige cookie y le contesta 401 al resto.
  const [wholesalePrices, setWholesalePrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!isWholesale) return;
    fetch('/api/store/wholesale-prices')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.prices) setWholesalePrices(data.prices); })
      .catch(() => {});
  }, [isWholesale]);
  // Mientras no resolvió el fetch queda en 0 = se muestra precio de lista, que
  // es el mismo criterio que ya tenía la ficha sin wholesalePrice cargado.
  const wholesalePriceOf = (id: string) => wholesalePrices[id] || 0;
  const productWholesalePrice = wholesalePriceOf(product.id);

  // Una óptica escribe al número mayorista (Cápsula Escarlata), como el botón
  // flotante: su "Soy de la óptica…, mayorista por $neto" caía en la línea de
  // la tienda, con el bot y los vendedores minoristas (revisión del 10/10/2026).
  const whatsappPhoneId = (isWholesale ? WHOLESALE_WHATSAPP_PHONE : (settings?.web_store_whatsapp_id || WHATSAPP_PHONE)).replace(/\D/g, '');
  const conGarantiaAdaptacion = fichaMuestraGarantiaDeAdaptacion(product.category);
  // Las dos lecturas de /admin/web con las reglas de toda la tienda.
  // `web_promo_installments` es texto libre y SOLO lo interpreta
  // leerPromoCuotas (CLAUDE.md): acá se parseaba con match(/\d+/), así que
  // escribir "12 cuotas" en /admin/web ponía "12 Cuotas" en el sello de la
  // ficha, al lado de las sin interés.
  const cashDiscount = descuentoTransferenciaDe(settings?.web_promo_cash_discount);
  const promoCuotas = leerPromoCuotas(settings?.web_promo_installments);
  const installmentsText = promoCuotas.texto;
  const installmentsCount = promoCuotas.cantidad;
  // "Anteojo completo desde $X" (auditoría 25/9): solo en Receta y fuera del
  // canal mayorista, con el mismo cálculo que el configurador. Null mientras
  // cargan los precios de cristal o si no cargan: entonces no se muestra.
  const opcionesCristal = useOpcionesCristal();
  const desde = anteojoCompletoDesde({
    producto: product,
    categoriaWeb: product.category,
    esMayorista: isWholesale,
    opciones: opcionesCristal,
    descuentoTransferenciaPct: cashDiscount,
  });

  const images = product.imagenesCatalogo && product.imagenesCatalogo.length > 0
    ? product.imagenesCatalogo.map((key: string) => resolveStorageUrl(key)).filter(Boolean)
    : (product.mockImage ? [product.mockImage] : []);

  // Alt por foto: usa el override cargado en el CRM o genera uno rico (marca + modelo + vista)
  const imageAlts: string[] = (product as any).imageAlts || [];
  const altFor = (index: number) =>
    (imageAlts[index]?.trim()) || `${product.brand} ${product.model}${index > 0 ? ` - vista ${index + 1}` : ''}`.trim();

  // Precio de oferta ("precio tachado"). La regla vive en src/lib/precio-oferta.ts:
  // la misma que usan la grilla de la tienda, el JSON-LD y el cotizador.
  const { final: effectivePrice, enOferta: hasSale } = precioConOferta(product as any);

  // La ficha abre ARRIBA, siempre. Ishtar (3/10/2026): entrando desde la
  // grilla ya scrolleada, en el celular la ficha aparecía por el final. Next
  // debería llevar al tope en cada navegación, pero en Safari con la grilla
  // larga no siempre lo hace; esto no depende de él. No se toca si la URL
  // trae un ancla (#cambios, etc.).
  useEffect(() => {
    if (!product?.id) return;
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [product?.id]);

  // Analítica propia: vista de ficha de producto (una vez por producto cargado).
  useEffect(() => {
    if (!product?.id) return;
    trackViewContent({
      id: product.id,
      name: `${product.brand || ''} ${product.model || ''}`.trim() || product.model,
      price: effectivePrice,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const getThumbnailLabel = (index: number) => {
    if (images[index]) {
      return (
        <Image unoptimized={String(images[index]).startsWith('data:')}
          src={images[index]}
          alt={altFor(index)}
          fill
          sizes="48px"
          className="object-cover p-1 rounded-full"
        />
      );
    }
    return <Camera className="w-4 h-4" />;
  };

  // Descripción: la primera frase queda como copete en itálica; el resto (specs, medidas) en texto regular
  const descriptionText = product.description?.trim() || `Anteojos de diseño ${product.category} modelo ${product.model} elaborados por ${product.brand}. Diseñados para brindar el mayor confort y estilo premium.`;
  const leadBreak = descriptionText.match(/[.!?…]["»)]*(\s+|$)/);
  const leadEnd = leadBreak && leadBreak.index !== undefined ? leadBreak.index + leadBreak[0].length : descriptionText.length;
  const descriptionLead = descriptionText.slice(0, leadEnd).trim();
  const descriptionRest = descriptionText.slice(leadEnd).trim();

  // El ÚNICO camino por el que la ficha agrega el armazón solo (sin cristales)
  // al carrito: lo usan "Comprar ahora" y, desde el 15/10/2026, también el
  // botón de la barra pegada de sol y clip-on. Hasta entonces ese botón hacía
  // `scrollIntoView` hasta "Comprar ahora" en vez de agregar: era el único
  // botón visible en la primera pantalla de esas fichas y, para quien lo
  // tocaba, "no pasaba nada" (en 30 días, 0 agregados al carrito desde ahí;
  // auditoría de fichas del 15/10). Ahora las dos puertas hacen lo mismo:
  // agregan y abren el carrito.
  const agregarArmazonAlCarrito = () => {
    // price SIEMPRE guarda el precio minorista: el mayorista se resuelve en
    // vivo por sesión (getItemUnitPrice) para que un carrito persistido nunca
    // muestre tarifa mayorista a un minorista (ni viceversa) tras login/logout.
    // El AddToCart lo dispara `addItem` en el store (useCart.ts): es el único
    // punto por el que pasan TODOS los caminos al carrito. Acá había una
    // segunda llamada que hacía que cada agregado desde la ficha contara dos
    // veces en Meta y GA4, con eventId distinto, así que la deduplicación del
    // CAPI tampoco los unía.
    addItem({
      productId: product.id,
      brand: product.brand,
      model: product.model,
      price: effectivePrice,
      wholesaleBasePrice: productWholesalePrice,
      image: images[0] || "/images/placeholder.svg",
      lensColor: null,
      lensConfig: {
        lensType: "NONE",
        treatment: null,
        color: null,
        prescriptionFile: null
      },
      quantity: 1,
      stock: typeof product.stock === 'number' ? product.stock : undefined
    });
    setIsAdded(true);
    setTimeout(() => {
      setIsOpen(true);
      setTimeout(() => setIsAdded(false), 2000);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white font-sans">
      <StorefrontNavbar theme="light" />

      {/* Sin id: #main-content ya lo usa el div del layout raíz (destino del
          "Saltar al contenido principal"), y repetirlo daría dos ids iguales. */}
      <main>
      <div className="flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0">
        
        <div className="w-full lg:w-[60%] bg-white relative flex items-center justify-center p-0 lg:p-12 min-h-0 lg:min-h-[50vh] lg:h-screen lg:max-h-[56rem] lg:sticky lg:top-0 border-r border-[#e5e5e5] overflow-hidden group">
          
          {/* Marca de agua decorativa (3% de opacidad). El modelo iba como <h2>:
              al estar antes del <h1> real, era el PRIMER encabezado del documento
              y un lector de pantalla anunciaba el nombre dos veces, arrancando por
              un nivel que no correspondía. Es decoración: div + aria-hidden. */}
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-center items-center opacity-[0.03] pointer-events-none overflow-hidden select-none">
            <div className="text-[15vw] leading-none font-bold tracking-tighter whitespace-nowrap">{product.brand}</div>
            <div className="text-[10vw] leading-none font-medium tracking-tight whitespace-nowrap">{product.model}</div>
          </div>

          {images.length > 1 && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 lg:bottom-auto lg:left-6 lg:top-1/2 lg:-translate-y-1/2 lg:-translate-x-0 z-20 flex flex-row lg:flex-col gap-3">
              {images.map((_: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-12 h-12 rounded-full relative overflow-hidden flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${
                    activeImageIndex === idx 
                      ? 'border-black scale-110 shadow-md ring-2 ring-black/20 ring-offset-1' 
                      : 'border-stone-200 hover:border-black/50 hover:scale-105'
                  }`}
                  title={idx === 0 ? "Ver producto" : `Ver vista ${idx + 1}`}
                >
                  {getThumbnailLabel(idx)}
                </button>
              ))}
            </div>
          )}

          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            /* 4:3 en celular y cuadrado en escritorio (Fase 1.2, 15/10/2026): con el
               recuadro cuadrado la foto sola ocupaba 390 px y el precio y el
               botón quedaban a 800-1.280 px, dos pantallas abajo. Las fotos van
               en `contain`, así que entran enteras igual. */
            className="w-full lg:w-[85%] aspect-[4/3] lg:aspect-square lg:max-h-full relative bg-[#fdfdfd] border border-[#f0f0f0] shadow-sm flex items-center justify-center"
          >
            {/* Fase 1.7: `mode="sync"` en vez de `"wait"`. Con "wait" la foto
                saliente se desvanecía ENTERA (0,4 s) antes de que la entrante
                empezara a cargar y a aparecer: ~1 s de recuadro en blanco en
                cada cambio. Las dos fotos están en absolute inset-0, así que
                en "sync" se cruzan una sobre otra sin hueco. Además, las fotos
                vecinas se precargan abajo. */}
            <AnimatePresence mode="sync">
              {images.length > 0 ? (
                <motion.div
                  key={activeImageIndex}
                  initial={activeImageIndex === 0 ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setZoomAbierto(true)}
                  role="button"
                  tabIndex={0}
                  aria-label="Ampliar foto"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoomAbierto(true); } }}
                  className={`absolute inset-0 z-10 isolate group-hover:scale-[1.3] group-hover:cursor-zoom-in cursor-zoom-in transition-transform duration-700 ease-out origin-center ${activeImageIndex === 0 ? 'mix-blend-multiply' : ''}`}
                >
                  {/* `sizes` en 45vw y no 51vw: medido en producción, el
                      recuadro de la galería mide 652px en una pantalla de 1440
                      y 570px en una de 1280 — o sea el 45% del ancho. Declarar
                      de más hace que el navegador pida un archivo más grande
                      del que después va a mostrar. */}
                  <Image unoptimized={String(images[activeImageIndex]).startsWith('data:')}
                    src={images[activeImageIndex]}
                    alt={altFor(activeImageIndex)}
                    fill
                    priority={activeImageIndex === 0}
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    // `contain` SIEMPRE, no solo en la foto del armazón. El
                    // recuadro es cuadrado y las fotos de la modelo son
                    // verticales: con `cover` el navegador recortaba el 33% de
                    // cada una centrándose en el ARCHIVO y no en la cara, y
                    // dejaba primerísimos planos con la cabeza cortada (Vega C2,
                    // Deneb C2). Con `contain` entra la foto entera y lo que
                    // sobra queda del color del recuadro.
                    style={{ objectFit: "contain", transform: "translateZ(0)" }}
                    className={activeImageIndex === 0 ? (((product.model || '').toLowerCase().includes('tl3932 c3') || product.id === 'cmq5d11hf002rhy61fhvqs7nj') ? "p-0 scale-125" : ((product.model || '').toLowerCase().includes('diana') ? "p-0 scale-110" : "p-4 lg:p-12")) : ""}
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500 text-xs font-black uppercase tracking-widest relative z-10">
                  Sin Imagen
                </div>
              )}
            </AnimatePresence>

            {/* Precarga de la foto siguiente y la anterior, con el MISMO
                `sizes` que la grande para que el navegador pida el mismo
                archivo optimizado y lo tenga en caché cuando se cambie. Fuera
                de pantalla y sin interacción: no se ve ni se toca. */}
            {images.length > 1 && [activeImageIndex + 1, activeImageIndex - 1]
              .map((i) => (i + images.length) % images.length)
              .filter((i, pos, arr) => i !== activeImageIndex && arr.indexOf(i) === pos)
              .map((i) => (
                <div key={`precarga-${i}`} aria-hidden="true" className="absolute inset-0 opacity-0 pointer-events-none -z-10">
                  <Image
                    unoptimized={String(images[i]).startsWith('data:')}
                    src={images[i]}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ))}

            {activeImageIndex > 0 && (
              <div className="absolute top-6 right-6 z-20 bg-black/50 backdrop-blur-md text-white text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Vista {activeImageIndex + 1}
              </div>
            )}

            {/* Sin chip "-9% OFF" sobre la foto: la rebaja se dice UNA vez, al
                lado del precio (src/lib/promo-visible.ts). */}
          </motion.div>
        </div>

        <div className="w-full lg:w-[40%] bg-[#fafafa] flex flex-col relative z-10">
          {/* ── Fase 1.2 (plan tienda, 15/10/2026): la primera pantalla en celular
              vende. El panel es una columna con `order-*` SOLO en celular:
              nombre → precio → botón primero; migas, colores, SKU, prueba
              social, specs y medios de pago recién después. En escritorio
              (`lg:order-none`) se mantiene el orden de siempre. Medido antes
              del cambio: el precio quedaba a 800 px y el botón a 1.080-1.275 px
              (dos pantallas de scroll) y el 97 % se iba sin tocar nada. */}
          <div className="p-5 lg:p-14 border-b border-[#e5e5e5] bg-white flex flex-col">
            {/* Breadcrumb visible (el JSON-LD BreadcrumbList ya existía; esto orienta al cliente) */}
            <nav aria-label="Ruta de navegación" className="order-4 lg:order-none mt-4 lg:mt-0 mb-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400">
              <Link href="/" className="hover:text-black transition-colors">Inicio</Link>
              <span aria-hidden="true">›</span>
              {(() => {
                const catMap: Record<string, { name: string; path: string }> = {
                  'Receta': { name: 'Receta', path: '/receta' },
                  'Sol': { name: 'Lentes de Sol', path: '/lentes-de-sol' },
                  'Clip-On': { name: 'Clip-On', path: '/clip-on' },
                };
                const cat = catMap[product.category] || { name: 'Tienda', path: '/tienda' };
                return <Link href={cat.path} className="hover:text-black transition-colors">{cat.name}</Link>;
              })()}
              <span aria-hidden="true">›</span>
              <span className="text-stone-600 normal-case tracking-normal font-medium truncate max-w-[180px]">{product.model}</span>
            </nav>
            {/* Kicker: el nombre estelar solo ("Antares") no le dice al visitante
                QUÉ está mirando — clave para quien cae desde un anuncio. */}
            {(() => {
              const tipoMap: Record<string, string> = {
                'Sol': 'Anteojos de sol',
                'Receta': 'Armazón para lentes recetados',
                'Clip-On': 'Armazón con clip-on de sol',
                'Cristal': 'Cristales a medida',
              };
              const tipo = tipoMap[product.category];
              return tipo ? (
                <p className="order-1 lg:order-none text-[11px] font-black uppercase tracking-[0.25em] text-[#8a6d3b] mb-1.5">
                  {tipo}
                </p>
              ) : null;
            })()}
            <h1 className="order-1 lg:order-none text-3xl lg:text-5xl font-serif tracking-tight mb-1 lg:mb-2 uppercase">
              {product.model}
            </h1>
            <p className="order-1 lg:order-none text-[11px] text-[#666] font-bold uppercase tracking-[0.2em] mb-3 lg:mb-4">
              por {product.brand}
            </p>

            {/* Todo lo que describe pero no decide (titanio, colores, SKU,
                prueba social, specs) va DESPUÉS del botón en celular. En
                escritorio `lg:contents` lo deja donde siempre estuvo. */}
            <div className="order-4 lg:order-none lg:contents">

            {/* Prominent Titanium highlight */}
            {product.material === "Titanio" && (
              <div className="mb-6 p-4.5 bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border border-stone-800 text-white rounded-xl shadow-lg flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black tracking-[0.25em] text-amber-400 uppercase">Colección Premium</span>
                  <span className="text-base font-serif tracking-wide text-stone-100">100% Titanio Puro</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/20 px-3 py-1.5 rounded-full whitespace-nowrap">
                  Ultraliviano y Resistente
                </span>
              </div>
            )}
            
            {/* Selector de color. Ishtar (14/9): "cuando estás navegando en uno
                que tiene más de un color no te das cuenta que de ahí mismo
                podés cambiarlo… me encantan los círculos pero creo que
                destacan más". Los círculos se quedan —le gustan— y lo que
                cambia es todo lo que los hacía pasar desapercibidos:
                · El título decía "Variantes de Color:", que describe pero no
                  invita. Ahora dice CUÁNTOS colores hay y qué hacer con ellos:
                  un dato concreto ("Este modelo viene en 4 colores") convierte
                  el bloque en una oferta, no en una etiqueta.
                · El bloque tiene marco y fondo propios, así que se lee como un
                  control y no como parte del texto de la ficha.
                · Los círculos pasan de 32 a 44 px, que además es el mínimo que
                  pide WCAG para algo que se toca con el dedo. */}
            {variants && variants.length > 1 && (
              <div className="mb-6 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <span className="text-xs text-stone-700 font-bold uppercase tracking-wider block mb-3">
                  Este modelo viene en {variants.length} colores — tocá para verlos
                </span>
                <div className="flex flex-wrap gap-3">
                  {variants.map((v) => {
                    const isActive = v.slug === product.slug;
                    return (
                      <Link
                        key={v.slug}
                        href={`/producto/${v.slug}`}
                        /* Cada color es una ficha propia (decisión de Ishtar: da
                           sensación de más variedad), así que cambiar de color es
                           NAVEGAR. Dos cosas lo hacían sentir una recarga entera:
                           1) `prefetch` explícito: el selector suele quedar abajo
                              del fold, y el prefetch automático de Next recién
                              dispara cuando el link entra en pantalla. Así llega
                              tarde. Cada variante son 27 KB (contra 117 KB de la
                              carga completa) y un modelo tiene 3-4 colores: sale
                              barato tenerlas listas antes del clic.
                           2) `scroll={false}`: sin esto la página salta al tope en
                              cada cambio, que es JUSTO lo que se lee como "se
                              recargó todo". Con esto te quedás mirando el mismo
                              lugar y solo cambia el anteojo. */
                        prefetch
                        scroll={false}
                        className={`group relative flex items-center justify-center rounded-full border p-1 transition-all duration-300 ${
                          isActive 
                            ? 'border-black scale-110 shadow-sm bg-white' 
                            : 'border-stone-200 hover:border-black bg-stone-50'
                        }`}
                        title={`Color: ${v.colorCode}`}
                      >
                        {v.imageUrl ? (
                          <div className="w-11 h-11 rounded-full overflow-hidden relative bg-white">
                            <Image unoptimized={String(resolveStorageUrl(v.imageUrl)).startsWith('data:')}
                              src={resolveStorageUrl(v.imageUrl)}
                              alt={v.colorCode}
                              fill
                              sizes="44px"
                              style={{ objectFit: 'contain' }}
                              className="transition-transform duration-300 group-hover:scale-110"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-mono font-bold uppercase px-2 py-1">
                            {v.colorCode}
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded shadow-sm border border-stone-100 whitespace-nowrap z-20 pointer-events-none">
                            {v.colorCode}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                <div className="h-4"></div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-6 text-[11px] text-stone-500">
              <span className="uppercase tracking-widest font-bold">SKU: {product.id?.substring(0, 8).toUpperCase() || 'ATELIER'}</span>
              {product.modelCode && (
                <>
                  <span className="mx-1">•</span>
                  <span className="uppercase tracking-widest font-bold">COD: {product.modelCode}</span>
                </>
              )}
              <span className="mx-1">•</span>
              {product.stock !== undefined && product.stock !== null ? (
                product.stock <= 0 ? (
                  <span className="text-red-500 font-bold uppercase tracking-widest">Agotado</span>
                ) : product.stock <= UMBRAL_ULTIMAS_UNIDADES ? (
                  <span className="text-stone-800 font-bold uppercase tracking-widest">{textoUltimasUnidades(product.stock)}</span>
                ) : (
                  <span className="text-stone-500 uppercase tracking-widest">En Stock</span>
                )
              ) : (
                <span className="text-stone-500 uppercase tracking-widest">En Stock</span>
              )}
            </div>

            {/* Prueba social: clientes REALES contados en la base (ventas
                respaldadas por pago o laboratorio). Tres escalones, del dato
                más específico al más general, y cada uno dice algo DISTINTO —
                si los tres dijeran lo mismo, el cartel deja de informar y pasa
                a ser un sello repetido en toda la tienda (pedido de Ishtar,
                14/9): este color exacto → este armazón en todos sus colores →
                la marca. El umbral lo aplica el server: lo que no alcanza no
                viaja, y si no alcanza ninguno no se muestra nada. Jamás se
                infla ni se inventa (Ley 24.240).
                El escalón del medio existe porque cada color tiene ficha
                propia: un armazón que vendió repartido entre tres colores no
                llegaba nunca al umbral de producto y caía siempre en la frase
                de marca, idéntica en cada ficha de esa marca. */}
            {!isWholesale && (clientesDelProducto > 0 || clientesDelModelo > 0 || clientesDeLaMarca > 0) && (
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 border border-stone-200 bg-stone-50 rounded-full px-3.5 py-1.5 text-[11px] font-bold text-stone-800">
                  <Users aria-hidden="true" className="w-3.5 h-3.5 text-stone-600" />
                  {clientesDelProducto > 0
                    ? `Elegido por ${clientesDelProducto} clientes`
                    : clientesDelModelo > 0
                      ? `${clientesDelModelo} clientes eligieron este armazón`
                      : `${clientesDeLaMarca} clientes ya eligieron ${product.brand}`}
                </span>
              </div>
            )}

            {/* Especificaciones del armazón. Los mismos datos que publica el
                feed de Shopping: el aviso que trajo al visitante no puede decir
                más que la ficha. Solo se muestran los que existen — el color
                sale del alt de la foto y puede faltar (ver frame-specs.ts). */}
            {((product as any).color || product.material || (product as any).shape) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  (product as any).color && { label: "Color", value: (product as any).color },
                  product.material && { label: "Material", value: product.material },
                  (product as any).shape && { label: "Forma", value: (product as any).shape },
                ]
                  .filter(Boolean)
                  .map((spec: any) => (
                    <span
                      key={spec.label}
                      className="inline-flex items-baseline gap-1.5 border border-stone-200 bg-stone-50 rounded-full px-3.5 py-1.5 text-[11px]"
                    >
                      <span className="font-bold uppercase tracking-widest text-stone-400">{spec.label}</span>
                      <span className="text-stone-800 capitalize">{spec.value}</span>
                    </span>
                  ))}
              </div>
            )}

            </div>

            {isWholesale ? (
              <div className="order-2 lg:order-none mb-6 flex flex-col gap-1">
                {/* Sin wholesalePrice cargado (> 0) el backend cobra retail:
                    no etiquetar el precio de lista como "Mayorista". */}
                {productWholesalePrice > 0 ? (
                  <>
                    <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded w-max">
                      Precio Mayorista Ópticas
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-black text-blue-600">
                        ${productWholesalePrice.toLocaleString("es-AR")}
                      </span>
                      {productWholesalePrice < product.price && (
                        <span className="text-sm font-medium text-stone-500 line-through">
                          ${(product.price || 0).toLocaleString("es-AR")} (P. Lista)
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-baseline gap-3">
                    {/* Sin precio mayorista cargado, a la óptica se le cobra el
                        de la tienda CON su oferta (effectiveFramePrice): era
                        lo que no se veía, mostraba el de lista. */}
                    <span className="text-3xl font-black text-stone-900">
                      ${formatearPrecio(effectivePrice)}
                    </span>
                    <span className="text-xs font-medium uppercase text-stone-400">
                      {hasSale ? 'Precio de oferta' : 'P. Lista'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* El precio protagonista es el de TRANSFERENCIA (pedido de
                    Ishtar, 31/8), con oferta o sin ella: los mismos números
                    que la tarjeta de la grilla (PricingService.vidrieraDeProducto).
                    Hasta el 10/10, con oferta la ficha mostraba en grande el de
                    TARJETA ($145.000) mientras la grilla decía $123.250 por el
                    mismo anteojo: quien entraba desde la grilla veía que el
                    precio "subía".
                    Desde el 15/10 (Fase 1.3) se muestran DOS números y UNA
                    promo: el de transferencia grande, "o $X con tarjeta"
                    chico, y al lado del grande o el sello de la rebaja o el
                    "15% OFF por transferencia" —nunca los dos, y sin tachado
                    (la regla vive en src/lib/promo-visible.ts). El precio con
                    tarjeta queda a la vista porque es el que declara el
                    JSON-LD y el feed de Merchant: Google desaprueba el
                    producto si el precio informado no aparece en la página. */}
                {(() => {
                  const v = PricingService.vidrieraDeProducto(product, { descuentoTransferenciaPct: cashDiscount, cuotasSinInteres: installmentsCount });
                  const promo = promoVisible(v, cashDiscount);
                  return (
                    <div className="order-2 lg:order-none mb-4 lg:mb-6">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="text-4xl lg:text-3xl font-black tracking-tight text-black">
                          ${formatearPrecio(v.transferencia)}
                        </span>
                        {promo.sello && (
                          <span className="text-[11px] font-black uppercase text-white bg-red-600 px-2 py-0.5 rounded">
                            {promo.sello}
                          </span>
                        )}
                        <span className="text-xs font-black uppercase tracking-wide text-emerald-700">
                          {promo.etiquetaTransferencia}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-stone-600">
                        o ${formatearPrecio(v.precio)} con tarjeta
                      </p>
                      {/* UNA línea de cuotas, la fórmula de marketing de
                          CLAUDE.md (31/8/2026, noche): sin el % y sin
                          "Mercado Pago". Las filas con importe siguen en
                          PaymentOptions, más abajo. */}
                      <p className="mt-1.5 text-xs font-medium text-stone-600">{LINEA_CUOTAS}</p>
                    </div>
                  );
                })()}

                <div className="order-5 lg:order-none lg:contents">
                  <PaymentOptions
                    variant="inline"
                    price={effectivePrice}
                    cashDiscount={cashDiscount}
                    installmentsText={installmentsText}
                    // El de transferencia ya es el número grande de arriba, con
                    // oferta o sin ella: la fila de pagos no lo repite.
                    hideTransferRow
                  />
                
                {/* Agotado no: el botón de cristales está apagado y el texto
                    invitaba a "elegir otros en el paso siguiente". */}
                {desde && !(product.stock !== undefined && product.stock <= 0) && (
                  <div className="mt-4 border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-base font-bold text-stone-900">
                      Anteojo completo desde {precioConSigno(desde.lista)}
                    </p>
                    <p className="text-sm text-stone-700">
                      {precioConSigno(desde.transferencia)} por transferencia
                    </p>
                    <p className="mt-1 text-xs text-stone-600">
                      Incluye cristales: {desde.cristal}. Podés elegir otros en el paso siguiente.
                    </p>
                  </div>
                )}
                </div>
              </>
            )}

            <div ref={ctaPrincipalRef} className="order-3 lg:order-none flex flex-col gap-3 mb-6 mt-0 lg:mt-4">
              {/* En Receta hay dos caminos y los dos son CTA plenos: configurar
                  cristales (negro) o llevarse el armazón solo (verde). Antes el
                  segundo era un botón chico de contorno que decía "Comprar solo
                  el armazón" y se leía como una opción menor y confusa. En
                  Sol/Clip-On/Cristal el único camino es comprar directo. */}
              {product.category === "Receta" && !isWholesale && (
                <button
                  disabled={product.stock !== undefined && product.stock <= 0}
                  onClick={() => setShowConfigurator(true)}
                  className="w-full px-8 py-5 text-[15px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-not-allowed shadow-xl hover:scale-[1.02] bg-black text-white hover:bg-stone-900 disabled:opacity-50 disabled:bg-stone-400 disabled:hover:scale-100 disabled:shadow-none"
                >
                  {(product.stock !== undefined && product.stock <= 0) ? "Agotado" : "Elegir mis cristales >"}
                </button>
              )}
              <button
                disabled={product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal" || isAdded}
                onClick={agregarArmazonAlCarrito}
                className={
                  // Verde -700, no -600: con texto blanco el -600 da ~3,3:1 y el
                  // piso del proyecto es 4,5:1 (ver globals.css y la regla de
                  // contraste). El -700 llega a ~5:1 y se sigue leyendo verde.
                  product.category === "Receta" && !isWholesale
                    ? `w-full px-8 py-4 text-[13px] font-black uppercase tracking-[0.16em] transition-all disabled:cursor-not-allowed ${isAdded ? 'bg-green-800 text-white' : 'bg-white text-stone-900 border-2 border-stone-900 hover:bg-stone-900 hover:text-white disabled:opacity-50 disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-white'}`
                    : `w-full px-8 py-5 text-[15px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-not-allowed shadow-xl hover:scale-[1.02] ${isAdded ? 'bg-green-700 text-white' : 'bg-black text-white hover:bg-stone-900 disabled:opacity-50 disabled:bg-stone-400 disabled:hover:scale-100 disabled:shadow-none'}`
                }
              >
                {/* A-12 (auditoría 2/9/26): en Receta este botón decía sólo
                    "Comprar", con el mismo peso visual que "Elegir mis
                    cristales". Dos llamados iguales = ninguno es el principal,
                    y peor: en un armazón recetado "comprar" se lleva el armazón
                    SIN cristales. La persona cree que compró sus anteojos.
                    Ahora dice qué se lleva y por cuánto, y es secundario de
                    verdad (contorno, no relleno). */}
                {isAdded
                  ? "Agregado al carrito ✓"
                  : ((product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal")
                    ? "Agotado"
                    : (product.category === "Receta" && !isWholesale
                      // El mismo número que el precio grande y que la barra fija
                      // de abajo: el de transferencia (15/10/2026; antes decía
                      // el de tarjeta y parecían dos precios distintos).
                      ? `Comprar solo el armazón — $${formatearPrecio(PricingService.vidrieraDeProducto(product, { descuentoTransferenciaPct: cashDiscount, cuotasSinInteres: installmentsCount }).transferencia)}`
                      : "Comprar Ahora >"))}
              </button>
            </div>

            {/* Franja de confianza en el punto de decisión: nota y cantidad de
                reseñas REALES de Google + la garantía canónica. El botón de
                garantía abre el acordeón con la letra chica, acá mismo. */}
            <div className="order-6 lg:order-none lg:contents">
            <TrustStrip
              conGarantia={conGarantiaAdaptacion}
              onGarantiaClick={() => {
                setActiveAccordion("returns");
                // El acordeón queda más abajo: llevar la vista hasta él para
                // que el clic tenga una respuesta visible.
                setTimeout(() => {
                  document.getElementById("acordeon-cambios")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              }}
            />

            {/* Envío gratis badge/banner con tiempo estimado */}
            <div className="flex items-center gap-3.5 px-4 py-3 bg-[#eefaf4] border border-[#d2f4e1] rounded-xl mb-6 shadow-sm animate-fade-in">
              <div className="p-2 bg-white rounded-full text-[#1b4332] shadow-sm">
                <Truck className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-black text-[#1b4332] uppercase tracking-widest">
                  ENVÍO SIN CARGO
                </span>
                <span className="text-[11px] text-[#2c6e49] leading-tight">
                  En Córdoba: <strong>Retiro por local</strong><br/>
                  Fuera de CBA: <strong>Envío sin cargo</strong> a todo el país.
                </span>
                {/* El empujón de "ya es tuyo": el plazo de despacho que este
                    mismo acordeón de envíos ya publica, dicho junto al CTA.
                    Solo plazos ya prometidos por la ficha — nada nuevo. */}
                <span className="text-[11px] text-[#2c6e49] leading-tight">
                  {product.category === "Receta" || product.category === "Clip-On"
                    ? <>Comprando hoy: solo armazón se despacha en <strong>{PLAZOS_DESPACHO.sinCristales}</strong>; con cristales, en <strong>{PLAZOS_DESPACHO.conCristales}</strong>.</>
                    : product.category === "Cristal"
                      ? <>Comprando hoy: calibrado y laboratorio en <strong>{PLAZOS_DESPACHO.conCristales}</strong>.</>
                      : <>Comprando hoy, se despacha en <strong>{PLAZOS_DESPACHO.sinCristales}</strong>.</>}
                </span>
              </div>
            </div>
            
            {/* Qué incluye (plan 15/10/2026, 1.5): la auditoría de fichas vio que
                sol y clip-on no decían si eran polarizados, si venía estuche ni
                cuándo llegaba, y la gente preguntaba por WhatsApp en vez de
                comprar. Los renglones salen de UN helper (lib/ficha/que-incluye),
                el mismo plazo que el checkout y los términos. */}
            <div className="order-6 lg:order-none mb-6 border border-stone-200 bg-white px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500 mb-2">Qué incluye</p>
              <ul className="space-y-1.5">
                {queIncluye(product.category).map((r) => (
                  <li key={r} className="flex gap-2 text-[13px] text-stone-800 leading-snug">
                    <span aria-hidden className="text-[#2c6e49]">✓</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

              {/* E-Commerce Accordions.
                  SIN animación de entrada: ver A-01 de la auditoría del 2/9/26.
                  El estado final es el default; la animación es la excepción. */}
            <div className="mt-8 border-t border-[#e5e5e5]">
              {/* Accordion: Descripción */}
              <div className="border-b border-[#e5e5e5]">
                <button 
                  onClick={() => setActiveAccordion(activeAccordion === "description" ? null : "description")}
                  className="w-full flex items-center justify-between py-5 text-[11px] font-bold uppercase tracking-widest text-black hover:opacity-70 transition-opacity"
                >
                  <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Descripción y Detalles</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${activeAccordion === "description" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeAccordion === "description" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6">
                        <p className={`text-sm font-serif italic text-[#666] leading-relaxed ${descriptionRest ? "mb-3" : "mb-6"}`}>
                          {descriptionLead}
                        </p>
                        {descriptionRest && (
                          <p className="text-sm text-[#444] leading-relaxed whitespace-pre-line mb-6">
                            {descriptionRest}
                          </p>
                        )}
                        
                        <div className="mb-6">
                          <GlassesDiagram
                            productId={product.id}
                            measures={{
                              lensWidth: product.lensWidth ?? null,
                              bridgeWidth: product.bridgeWidth ?? null,
                              templeLength: product.templeLength ?? null,
                              frameHeight: product.frameHeight ?? null,
                            }}
                            editable={false}
                            consultaHref={buildWhatsAppUrl(
                              `¡Hola! Quiero consultar las medidas del anteojo ${product.brand || ''} ${product.model || ''}.`,
                              { pageUrl: currentPageUrl(`/producto/${product.slug}`), phone: whatsappPhoneId }
                            )}
                          />
                        </div>

                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(window.location.href);
                              alert("¡Enlace copiado al portapapeles!");
                            } catch {
                              window.prompt("Copiá el enlace:", window.location.href);
                            }
                          }}
                          className="flex items-center gap-2 text-xs uppercase font-bold tracking-widest text-[#78716c] hover:text-black transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Copiar Enlace del Producto
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion: Envíos */}
              <div className="border-b border-[#e5e5e5]">
                <button 
                  onClick={() => setActiveAccordion(activeAccordion === "shipping" ? null : "shipping")}
                  className="w-full flex items-center justify-between py-5 text-[11px] font-bold uppercase tracking-widest text-black hover:opacity-70 transition-opacity"
                >
                  <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Medios de Envío</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${activeAccordion === "shipping" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeAccordion === "shipping" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6">
                        <div className="bg-[#f0faeb] border border-[#d3ecc3] p-4 rounded-sm flex items-center gap-3">
                          <Truck className="w-5 h-5 text-[#2b6a22]" />
                          <div>
                            <p className="text-sm font-bold text-[#2b6a22]">Envío gratis a todo el país</p>
                            <p className="text-[11px] text-[#2b6a22]/80 mt-0.5">Sin monto mínimo, a todo el país.</p>
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs flex flex-col gap-3 rounded-lg">
                          <div className="flex gap-2 items-center font-bold text-black border-b border-stone-200 pb-2">
                            <Truck className="w-4 h-4 text-[#1b4332]" />
                            <span>Opciones de Envío Correo Argentino (Sin Cargo)</span>
                          </div>
                          
                          <div className="space-y-3.5 divide-y divide-stone-100">
                            <div className="flex flex-col gap-1 pt-1.5 first:pt-0">
                              <div className="flex justify-between items-baseline">
                                <span className="font-bold text-stone-900">1. Envío a Domicilio</span>
                                <span className="text-xs font-bold text-[#1b4332] bg-green-50 px-2 py-0.5 rounded-sm">GRATIS</span>
                              </div>
                              <p className="text-[11px] text-stone-600 mt-1">
                                Llega a tu domicilio en <strong>3 a 5 días hábiles</strong> desde que se despacha.
                              </p>
                            </div>

                            <div className="flex flex-col gap-1 pt-3">
                              <div className="flex justify-between items-baseline">
                                <span className="font-bold text-stone-900">2. Envío a Sucursal Oficial</span>
                                <span className="text-xs font-bold text-[#1b4332] bg-green-50 px-2 py-0.5 rounded-sm">GRATIS</span>
                              </div>
                              <p className="text-[11px] text-stone-600 mt-1">
                                Retirás en la sucursal de Correo Argentino en <strong>3 a 5 días hábiles</strong> desde que se despacha.
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 bg-[#fdfaf2] border border-[#f5ecd5] p-3 rounded text-[11px] text-[#856404] leading-relaxed">
                            <p className="font-bold mb-1">⏰ Tiempos de preparación / despacho:</p>
                            <p>• <strong>Solo Armazón / Anteojo de sol:</strong> Despacho en <strong>2 días hábiles</strong>.</p>
                            <p>• <strong>Con Cristales Recetados:</strong> Calibrado y laboratorio en <strong>5 días hábiles</strong>.</p>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 mt-4 leading-relaxed">
                          Hacemos envíos a todo el país. Todos nuestros despachos se realizan con embalaje reforzado para garantizar que tus anteojos lleguen en perfecto estado.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion: Garantía */}
              <div id="acordeon-cambios" className="border-b border-[#e5e5e5]">
                <button 
                  onClick={() => setActiveAccordion(activeAccordion === "returns" ? null : "returns")}
                  className="w-full flex items-center justify-between py-5 text-[11px] font-bold uppercase tracking-widest text-black hover:opacity-70 transition-opacity"
                >
                  <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Cambios y Devoluciones</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${activeAccordion === "returns" ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeAccordion === "returns" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-6">
                        <ul className="text-xs text-stone-600 space-y-2 list-disc pl-4">
                          <li>Tenés 10 días hábiles para realizar cambios si el armazón no te convence, sin ningún desperfecto.</li>
                          {/* Decía "garantía de adaptación total en cristales
                              multifocales": la cobertura real no es todo
                              multifocal, es Varilux + Super Blue. Y solo en
                              fichas de receta: sol y clip-on no la tienen. */}
                          {conGarantiaAdaptacion && (
                            <li>{GARANTIA_ADAPTACION.RESUMEN} {GARANTIA_ADAPTACION.REQUISITO}</li>
                          )}
                          <li>Para iniciar un cambio, contactanos por WhatsApp con tu número de orden.</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </div>
          </div>

          <div className="p-8 lg:p-14 lg:pt-8 flex-1 flex flex-col gap-3">
            
            {/* Sellos de Confianza (Trust Badges) - Movidos debajo del carrito */}
            <div className="my-2 py-3 border-y border-[#e5e5e5]/50 grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center text-center p-1">
                <ShieldCheck className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">Garantía</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <CreditCard className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">{installmentsCount} Cuotas</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Truck className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">Envío Gratis</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Percent className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">{cashDiscount}% OFF</span>
              </div>
            </div>
            
            {/* En Receta este botón ya no hace falta: "Elegir mis cristales" es el CTA primario arriba. */}
            {!(product.category === "Receta" && !isWholesale) && (
              <button
                onClick={() => setShowConfigurator(true)}
                disabled={product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal"}
                className={`w-full border px-8 py-4 text-[11px] font-bold uppercase tracking-widest transition-colors shadow-sm ${
                  (product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal")
                    ? 'border-stone-300 bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'border-[#e5e5e5] bg-white text-black hover:border-black'
                }`}
              >
                + Agregar Cristales Con Receta
              </button>
            )}

            {images.length > 1 && (
              <div className="flex flex-wrap gap-2 w-full mt-2">
                {images.map((_: any, idx: number) => {
                  if (idx === 0) return null;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(activeImageIndex === idx ? 0 : idx)}
                      className={`flex-1 min-w-[120px] py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 rounded-sm border ${
                        activeImageIndex === idx
                          ? 'bg-[#c8a55c] text-white border-[#c8a55c] hover:bg-[#8a6d3b]'
                          : 'border-stone-200 text-stone-700 bg-white hover:border-[#c8a55c] hover:text-[#8a6d3b]'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {activeImageIndex === idx ? "Ocultar" : `Ver Foto ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-3">
              <a 
                href={buildWhatsAppUrl(
                  isWholesale
                    ? `¡Hola! Soy de la óptica ${currentUser?.name || ''} y quiero consultar por el anteojo mayorista ${product.brand || ''} ${product.model || ''} por $${formatearPrecio(productWholesalePrice || product.price || 0)}.`
                    : (() => {
                        // Los mismos números que la tarjeta (vidrieraDeProducto):
                        // el mensaje decía "6 cuotas" fijas y calculaba el % a mano.
                        const v = PricingService.vidrieraDeProducto(product, { descuentoTransferenciaPct: cashDiscount, cuotasSinInteres: installmentsCount });
                        return `¡Hola! Quiero comprar el anteojo ${product.brand || ''} ${product.model || ''} — $${formatearPrecio(v.transferencia)} por transferencia, ${v.cuotas} cuotas sin interés de $${formatearPrecio(v.valorCuota)} o ${textoCuotas12(v.cuota12)}. ¿Me pasarían los datos de pago?`;
                      })(),
                  { pageUrl: currentPageUrl(`/producto/${product.slug}`), phone: whatsappPhoneId }
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 border-2 border-[#1b4332] text-[#1b4332] hover:bg-[#1b4332] hover:text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-sm transition-all duration-300"
              >
                <WhatsAppIcon className="w-4 h-4 fill-current" /> Comprar directo por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {similarProducts && similarProducts.length > 0 && (
        <div className="px-8 lg:px-14 pb-12 bg-white">
          <div className="border-t border-[#e5e5e5] pt-12">
            <h2 className="text-xs font-black uppercase tracking-widest text-black mb-6">Productos que te pueden interesar</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {similarProducts.map((p: any, idx: number) => (
                <Link 
                  key={idx} 
                  href={`/producto/${p.slug}`}
                  className="group block bg-white border border-[#f0f0f0] hover:border-stone-300 p-4 transition-all duration-300 rounded-lg"
                >
                  <div className="aspect-square relative overflow-hidden bg-stone-50 mb-3 rounded-md">
                    <Image unoptimized={String(resolveStorageUrl(p.imageUrl)).startsWith('data:')}
                      src={resolveStorageUrl(p.imageUrl)} 
                      alt={`${p.brand} ${p.model}`} 
                      fill 
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">{p.brand}</p>
                  <h3 className="text-xs font-bold text-stone-900 truncate uppercase mt-0.5">{p.model}</h3>
                  <p className="text-xs text-stone-600 font-medium mt-1">
                    {(() => {
                      if (isWholesale) return <>${formatearPrecio(wholesalePriceOf(p.id) || p.price || 0)} <span className="text-[10px] font-black text-blue-600">(Mayorista)</span></>;
                      /* Mismo criterio que toda la vidriera (Ishtar, 31/8) y los
                         mismos números (PricingService.vidrieraDeProducto): el
                         GRANDE es el de transferencia, con la oferta resuelta y
                         el de lista tachado solo si hay rebaja. Hasta el 10/10
                         un relacionado en oferta mostraba el de TARJETA en rojo. */
                      const v = PricingService.vidrieraDeProducto(p, { descuentoTransferenciaPct: cashDiscount, cuotasSinInteres: installmentsCount });
                      return (
                        <>
                          <span className="font-bold text-stone-900">${formatearPrecio(v.transferencia)}</span>
                          {/* Una sola promo por tarjeta (promo-visible.ts): el
                              sello de la rebaja si la hay, si no el 15 %. */}
                          {promoVisible(v, cashDiscount).sello && (
                            <span className="ml-1 text-[10px] font-black uppercase text-white bg-red-600 px-1.5 py-0.5 rounded">{promoVisible(v, cashDiscount).sello}</span>
                          )}
                          <span className="text-[10px] text-emerald-700 font-bold"> {promoVisible(v, cashDiscount).etiquetaTransferenciaCorta}</span>
                          <span className="block text-[10px] text-stone-500">{textoCuotas12(v.cuota12)}</span>
                          <span className="block text-[10px] text-stone-500">{v.cuotas} cuotas sin interés de ${formatearPrecio(v.valorCuota)}</span>
                        </>
                      );
                    })()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reseñas propias de este producto (moderadas) */}
      <div className="max-w-3xl mx-auto px-6 lg:px-14 w-full">
        <ProductReviews productId={product.id} />
      </div>

      {/* Prueba social: reseñas reales de Google, pegadas al punto de decisión */}
      <GoogleReviews />
      </main>

      {footer}

      {/* ── A-16: barra de compra fija en celular ──────────────────────────
          Aparece recién cuando los botones de arriba salieron de pantalla, así
          que nunca compite con ellos. Lleva la miniatura, el nombre y el precio
          para que se entienda de qué producto se está hablando después de tres
          pantallas de medidas y garantías.
          De paso resuelve dos cosas más que marcó la auditoría: el precio queda
          siempre a la vista (A-01) y el botón de WhatsApp flotante ya no es el
          único elemento fijo compitiendo por el pulgar (A-11). */}
      {!isWholesale && (() => {
        const agotado = product.stock !== undefined && product.stock <= 0;
        const vBarra = PricingService.vidrieraDeProducto(product, { descuentoTransferenciaPct: cashDiscount, cuotasSinInteres: installmentsCount });
        const claseBarra = `lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-stone-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
          ctaFueraDeVista ? 'translate-y-0' : 'translate-y-full'
        }`;
        if (product.category === "Receta") {
          // Fase 1.4 (15/10/2026): en receta la barra lleva las DOS salidas,
          // visibles en todo el scroll. Hasta hoy solo mostraba "Elegir
          // cristales" y "Comprar solo el armazón" quedaba a 1.186 px: quien
          // ya tiene cristales o quiere solo el armazón no tenía puerta a mano.
          return (
            <div className={claseBarra} aria-hidden={!ctaFueraDeVista}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500 truncate mb-1.5">
                {product.model} · ${formatearPrecio(vBarra.transferencia)} por transferencia
              </p>
              <div className="flex gap-2">
                <button
                  disabled={agotado || isAdded}
                  onClick={agregarArmazonAlCarrito}
                  className={`flex-1 min-h-11 px-3 text-[11px] font-black uppercase tracking-wide rounded-full border-2 transition-colors disabled:opacity-50 ${isAdded ? 'bg-green-800 border-green-800 text-white' : 'bg-white border-stone-900 text-stone-900 hover:bg-stone-100'}`}
                >
                  {/* El mismo número que la línea de arriba y que el precio
                      grande de la ficha: el de transferencia. */}
                  {agotado ? "Agotado" : isAdded ? "Agregado ✓" : `Solo armazón $${formatearPrecio(vBarra.transferencia)}`}
                </button>
                <button
                  disabled={agotado}
                  onClick={() => setShowConfigurator(true)}
                  className="flex-1 min-h-11 px-3 bg-black text-white text-[11px] font-black uppercase tracking-wide rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:bg-stone-400"
                >
                  {agotado ? "Agotado" : "Elegir mis cristales"}
                </button>
              </div>
            </div>
          );
        }
        return (
        <div className={`${claseBarra} flex items-center gap-3`} aria-hidden={!ctaFueraDeVista}>
          {images[0] && (
            <div className="relative w-12 h-12 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-stone-100">
              <Image
                unoptimized={String(images[0]).startsWith('data:')}
                src={images[0]}
                alt=""
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-900 truncate">{product.model}</p>
            {/* 29/9/26: el grande es el de transferencia, como en la ficha (arriba).
                Con el de lista acá, el primer número que se veía en celular era
                el más caro. Los mismos números que el precio grande de la ficha
                (PricingService.vidrieraDeProducto). */}
            <p className="text-[13px] font-black text-stone-900">
              ${formatearPrecio(vBarra.transferencia)}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">por transferencia</span>
            </p>
            <p className="text-[10px] font-medium text-stone-500">${formatearPrecio(effectivePrice)} con tarjeta</p>
          </div>
          <button
            disabled={agotado || isAdded}
            // Agrega de verdad, igual que "Comprar ahora" (ver
            // agregarArmazonAlCarrito): antes solo scrolleaba hasta ese botón
            // y en 30 días no produjo un solo agregado al carrito.
            onClick={agregarArmazonAlCarrito}
            className="flex-shrink-0 min-h-11 px-5 bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:bg-stone-400"
          >
            {agotado ? "Agotado" : (isAdded ? "Agregado ✓" : "Comprar")}
          </button>
        </div>
        );
      })()}

      {zoomAbierto && images.length > 0 && (
        <GaleriaZoom
          imagenes={images}
          alts={images.map((_: string, i: number) => altFor(i))}
          indiceInicial={activeImageIndex}
          onCerrar={() => setZoomAbierto(false)}
        />
      )}

      {/* Modal Configurador de Cristales para la vista de producto.

          A-06 (auditoría 2/9/26): medía 683 px en un alto útil de ~594 px, así
          que en el paso 01 "bifocal" y "solo armazón" quedaban debajo del borde
          de la pantalla — se elegía entre las opciones que se veían, no entre
          las que hay.

          En celular pasa a pantalla completa: sin márgenes, sin esquinas
          redondeadas, con el cierre fijo arriba y el cuerpo scrolleando por
          dentro. De 640 px para arriba sigue siendo el modal centrado de
          siempre, que ahí entra holgado. */}
      {showConfigurator && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Armá tus cristales para ${product.model}`}
          className="fixed inset-0 z-[200] flex min-h-full items-stretch sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfigurator(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-[#fafafa] w-full sm:max-w-4xl min-h-full sm:min-h-0 sm:max-h-[85vh] overflow-y-auto px-5 pt-16 pb-8 sm:p-12 text-black rounded-none sm:rounded-[2rem] shadow-2xl z-10"
          >
            <button
              onClick={() => setShowConfigurator(false)}
              aria-label="Cerrar configurador"
              className="fixed sm:absolute top-3 right-3 sm:top-4 sm:right-4 p-2 min-h-11 min-w-11 flex items-center justify-center text-stone-600 bg-white/90 sm:bg-transparent backdrop-blur sm:backdrop-blur-none shadow-sm sm:shadow-none hover:text-black hover:bg-stone-200 rounded-full transition-colors z-20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <LensConfigurator
              /* effectivePrice, no product.price: con oferta activa, el precio de
                 lista inflaba el total del carrito y el "importe a transferir"
                 quedaba por encima de lo que el backend cobra (auditoría 19/8). */
              basePrice={effectivePrice || 0}
              wholesaleBasePrice={productWholesalePrice}
              productId={product.id}
              productInfo={{ brand: product.brand, model: product.model, image: images[0] || "/images/placeholder.svg" }}
              onSuccess={() => {
                setShowConfigurator(false);
                setIsOpen(true);
              }}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
