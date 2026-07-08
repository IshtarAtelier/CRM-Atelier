"use client";
import Image from "next/image";
import Link from "next/link";
import { WHATSAPP_PHONE } from "@/lib/constants";

import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Share2, ChevronDown, Truck, Package, ShieldCheck, CreditCard, Percent } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { trackAddToCart } from "@/lib/tracking";

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
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  
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

  const whatsappPhoneId = (settings?.web_store_whatsapp_id || WHATSAPP_PHONE).replace(/\D/g, '');
  const cashDiscount = settings && settings.web_promo_cash_discount && !isNaN(Number(settings.web_promo_cash_discount)) ? Number(settings.web_promo_cash_discount) : 15;
  const installmentsText = settings ? settings.web_promo_installments : "6 cuotas sin interés";

  const images = product.imagenesCatalogo && product.imagenesCatalogo.length > 0
    ? product.imagenesCatalogo.map((key: string) => resolveStorageUrl(key)).filter(Boolean)
    : (product.mockImage ? [product.mockImage] : []);

  // Alt por foto: usa el override cargado en el CRM o genera uno rico (marca + modelo + vista)
  const imageAlts: string[] = (product as any).imageAlts || [];
  const altFor = (index: number) =>
    (imageAlts[index]?.trim()) || `${product.brand} ${product.model}${index > 0 ? ` - vista ${index + 1}` : ''}`.trim();

  // Precio de oferta ("precio tachado"): solo si es un descuento real sobre el precio de lista
  const listPrice = product.price || 0;
  const saleRaw = (product as any).salePrice;
  const hasSale = saleRaw != null && saleRaw > 0 && saleRaw < listPrice;
  const effectivePrice = hasSale ? saleRaw : listPrice;
  const pctOff = hasSale ? Math.round((1 - saleRaw / listPrice) * 100) : 0;

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

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white font-sans">
      <StorefrontNavbar theme="light" />
      
      <div className="flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0">
        
        <div className="w-full lg:w-[60%] bg-white relative flex items-center justify-center p-0 lg:p-12 min-h-[50vh] lg:h-screen lg:max-h-[56rem] lg:sticky lg:top-0 border-r border-[#e5e5e5] overflow-hidden group">
          
          <div className="absolute inset-0 flex flex-col justify-center items-center opacity-[0.03] pointer-events-none overflow-hidden select-none">
            <div className="text-[15vw] leading-none font-bold tracking-tighter whitespace-nowrap">{product.brand}</div>
            <h2 className="text-[10vw] leading-none font-medium tracking-tight whitespace-nowrap">{product.model}</h2>
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-[85%] aspect-square lg:max-h-full relative bg-[#fdfdfd] border border-[#f0f0f0] shadow-sm flex items-center justify-center"
          >
            <AnimatePresence mode="wait">
              {images.length > 0 ? (
                <motion.div
                  key={activeImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`absolute inset-0 z-10 isolate group-hover:scale-[1.3] group-hover:cursor-zoom-in transition-transform duration-700 ease-out origin-center ${activeImageIndex === 0 ? 'mix-blend-multiply' : ''}`}
                >
                  <Image unoptimized={String(images[activeImageIndex]).startsWith('data:')}
                    src={images[activeImageIndex]}
                    alt={altFor(activeImageIndex)}
                    fill
                    priority={activeImageIndex === 0}
                    sizes="(max-width: 1024px) 100vw, 85vw"
                    style={{ objectFit: activeImageIndex === 0 ? "contain" : "cover", transform: "translateZ(0)" }}
                    className={activeImageIndex === 0 ? (((product.model || '').toLowerCase().includes('tl3932 c3') || product.id === 'cmq5d11hf002rhy61fhvqs7nj') ? "p-0 scale-125" : ((product.model || '').toLowerCase().includes('diana') ? "p-0 scale-110" : "p-8 lg:p-12")) : ""}
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-500 text-xs font-black uppercase tracking-widest relative z-10">
                  Sin Imagen
                </div>
              )}
            </AnimatePresence>
            
            {activeImageIndex > 0 && (
              <div className="absolute top-6 right-6 z-20 bg-black/50 backdrop-blur-md text-white text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Vista {activeImageIndex + 1}
              </div>
            )}

            {hasSale && (
              <div className="absolute top-6 left-6 z-20 bg-red-600 text-white text-[11px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full shadow-lg">
                -{pctOff}% OFF
              </div>
            )}
          </motion.div>
        </div>

        <div className="w-full lg:w-[40%] bg-[#fafafa] flex flex-col relative z-10">
          <div className="p-8 lg:p-14 border-b border-[#e5e5e5] bg-white">
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-4xl lg:text-5xl font-serif tracking-tight mb-2 uppercase"
            >
              {product.model}
            </motion.h1>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-[11px] text-[#666] font-bold uppercase tracking-[0.2em] mb-4"
            >
              por {product.brand}
            </motion.p>

            {/* Prominent Titanium highlight */}
            {product.material === "Titanio" && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.8 }}
                className="mb-6 p-4.5 bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border border-stone-800 text-white rounded-xl shadow-lg flex items-center justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-black tracking-[0.25em] text-amber-400 uppercase">Colección Premium</span>
                  <span className="text-base font-serif tracking-wide text-stone-100">100% Titanio Puro</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/20 px-3 py-1.5 rounded-full whitespace-nowrap">
                  Ultraliviano y Resistente
                </span>
              </motion.div>
            )}
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.8 }}
              className="flex flex-wrap items-center gap-2 mb-6 text-[11px] text-stone-500"
            >
              <span className="uppercase tracking-widest font-bold">SKU: {product.id?.substring(0, 8).toUpperCase() || 'ATELIER'}</span>
              <span className="mx-1">•</span>
              {product.stock !== undefined && product.stock !== null ? (
                product.stock <= 0 ? (
                  <span className="text-red-500 font-bold uppercase tracking-widest">Agotado</span>
                ) : product.stock <= 3 ? (
                  <span className="text-stone-800 font-bold uppercase tracking-widest">¡Últimas {product.stock} u.!</span>
                ) : (
                  <span className="text-stone-500 uppercase tracking-widest">En Stock</span>
                )
              ) : (
                <span className="text-stone-500 uppercase tracking-widest">En Stock</span>
              )}
            </motion.div>

            {variants && variants.length > 1 && (
              <div className="mb-6">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block mb-2.5">
                  Variantes de Color:
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {variants.map((v) => {
                    const isActive = v.slug === product.slug;
                    return (
                      <Link
                        key={v.slug}
                        href={`/producto/${v.slug}`}
                        className={`group relative flex items-center justify-center rounded-full border p-1 transition-all duration-300 ${
                          isActive 
                            ? 'border-black scale-110 shadow-sm bg-white' 
                            : 'border-stone-200 hover:border-black bg-stone-50'
                        }`}
                        title={`Color: ${v.colorCode}`}
                      >
                        {v.imageUrl ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden relative bg-white">
                            <Image unoptimized={String(resolveStorageUrl(v.imageUrl)).startsWith('data:')}
                              src={resolveStorageUrl(v.imageUrl)}
                              alt={v.colorCode}
                              fill
                              sizes="32px"
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
            
            {isWholesale ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="mb-6 flex flex-col gap-1"
              >
                <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded w-max">
                  Precio Mayorista Ópticas
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-blue-600">
                    ${(product.wholesalePrice || product.price || 0).toLocaleString("es-AR")}
                  </span>
                  {product.wholesalePrice < product.price && (
                    <span className="text-sm font-medium text-stone-500 line-through">
                      ${(product.price || 0).toLocaleString("es-AR")} (P. Lista)
                    </span>
                  )}
                </div>
              </motion.div>
            ) : (
              <>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="mb-6"
                >
                  {hasSale ? (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-3xl font-black tracking-tight text-red-600">
                        ${effectivePrice.toLocaleString("es-AR")}
                      </span>
                      <span className="text-lg font-medium text-stone-400 line-through">
                        ${listPrice.toLocaleString("es-AR")}
                      </span>
                      <span className="text-xs font-black uppercase text-white bg-red-600 px-2 py-1 rounded">
                        {pctOff}% OFF
                      </span>
                    </div>
                  ) : (
                    <p className="text-2xl font-light tracking-tight text-black">
                      ${(product.price || 0).toLocaleString("es-AR")}
                    </p>
                  )}
                </motion.div>

                <PaymentOptions
                  variant="inline"
                  price={effectivePrice}
                  cashDiscount={cashDiscount}
                  installmentsText={installmentsText}
                />
              </>
            )}

            <div className="flex flex-col gap-3 mb-6 mt-4">
              <button
                disabled={product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal" || isAdded}
                onClick={() => {
                  const itemPrice = isWholesale && product.wholesalePrice > 0 ? product.wholesalePrice : effectivePrice;
                  trackAddToCart({
                    id: product.id,
                    name: product.model,
                    price: itemPrice,
                    quantity: 1
                  });
                  addItem({
                    productId: product.id,
                    brand: product.brand,
                    model: product.model,
                    price: itemPrice,
                    image: images[0] || "/images/placeholder.svg",
                    lensColor: null,
                    lensConfig: {
                      lensType: "NONE",
                      treatment: null,
                      color: null,
                      prescriptionFile: null
                    },
                    quantity: 1
                  });
                  setIsAdded(true);
                  setTimeout(() => {
                    setIsOpen(true);
                    setTimeout(() => setIsAdded(false), 2000);
                  }, 500);
                }}
                className={`w-full px-8 py-5 text-[15px] font-black uppercase tracking-[0.2em] transition-all disabled:cursor-not-allowed shadow-xl hover:scale-[1.02] ${isAdded ? 'bg-green-600 text-white' : 'bg-black text-white hover:bg-stone-900 disabled:opacity-50 disabled:bg-stone-400 disabled:hover:scale-100 disabled:shadow-none'}`}
              >
                {isAdded ? "¡Ya son tuyos! 🎉" : ((product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal") ? "Agotado" : "Comprar Ahora >")}
              </button>
            </div>

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
              </div>
            </div>
            
              {/* E-Commerce Accordions */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-8 border-t border-[#e5e5e5]"
            >
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
                          />
                        </div>

                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert("¡Enlace copiado al portapapeles!");
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
                            <p className="text-[11px] text-[#2b6a22]/80 mt-0.5">Promoción especial por esta semana.</p>
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
              <div className="border-b border-[#e5e5e5]">
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
                          <li>Tenés 30 días para realizar cambios si el armazón no te convence.</li>
                          <li>Garantía de adaptación total en cristales multifocales.</li>
                          <li>Para iniciar un cambio, contactanos por WhatsApp con tu número de orden.</li>
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
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
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">6 Cuotas</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Truck className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">Envío Gratis</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Percent className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-800">15% OFF</span>
              </div>
            </div>
            
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
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(
                  isWholesale 
                    ? `¡Hola! Soy de la óptica ${currentUser?.name || ''} y quiero consultar por el anteojo mayorista ${product.brand || ''} ${product.model || ''} por $${(product.wholesalePrice || product.price || 0).toLocaleString("es-AR")}.`
                    : `¡Hola! Quiero comprar el anteojo ${product.brand || ''} ${product.model || ''} — $${Math.round(effectivePrice * 0.85).toLocaleString("es-AR")} por transferencia o $${effectivePrice.toLocaleString("es-AR")} en cuotas. ¿Me pasarían los datos de pago?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-stone-500 font-bold uppercase tracking-widest hover:text-[#1b4332] transition-colors flex items-center justify-center gap-1.5 underline underline-offset-4"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-current" /> Comprar directo por WhatsApp
              </a>

              <a 
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(`¡Hola! Tengo una consulta sobre el modelo ${product.brand || ''} ${product.model || ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-stone-500 font-bold uppercase tracking-widest hover:text-black transition-colors flex items-center justify-center gap-1.5"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-current" /> Escribinos por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {similarProducts && similarProducts.length > 0 && (
        <div className="px-8 lg:px-14 pb-12 bg-white">
          <div className="border-t border-[#e5e5e5] pt-12">
            <h3 className="text-xs font-black uppercase tracking-widest text-black mb-6">Productos que te pueden interesar</h3>
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
                  <h4 className="text-xs font-bold text-stone-900 truncate uppercase mt-0.5">{p.model}</h4>
                  <p className="text-xs text-stone-600 font-medium mt-1">
                    {(() => {
                      const pSale = p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price;
                      if (isWholesale) return <>${(p.wholesalePrice > 0 ? p.wholesalePrice : (p.price || 0)).toLocaleString("es-AR")} <span className="text-[10px] font-black text-blue-600">(Mayorista)</span></>;
                      if (pSale) return <><span className="text-red-600 font-bold">${p.salePrice.toLocaleString("es-AR")}</span> <span className="text-[10px] text-stone-400 line-through">${(p.price || 0).toLocaleString("es-AR")}</span></>;
                      return <>${(p.price || 0).toLocaleString("es-AR")}</>;
                    })()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {footer}

      

      {/* Modal Configurador de Cristales para la vista de producto */}
      {showConfigurator && (
        <div className="fixed inset-0 z-[200] flex min-h-full items-center justify-center p-4 overflow-y-auto">
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
            className="relative bg-[#fafafa] w-full max-w-4xl max-h-[85vh] overflow-y-auto px-6 py-8 sm:p-12 text-black rounded-[2rem] shadow-2xl z-10"
          >
            <button
              onClick={() => setShowConfigurator(false)}
              aria-label="Cerrar configurador"
              className="absolute top-4 right-4 p-2 text-stone-500 hover:text-black hover:bg-stone-200 rounded-full transition-colors z-20"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <LensConfigurator 
              basePrice={product.price || 0} 
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
