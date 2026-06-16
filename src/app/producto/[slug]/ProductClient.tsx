"use client";
import Image from "next/image";
import Link from "next/link";
import { WHATSAPP_PHONE } from "@/lib/constants";

import { LensConfigurator } from "@/components/Storefront/LensConfigurator";
import { GlassesDiagram } from "@/components/Storefront/GlassesDiagram";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, User, UserPlus, Share2, ChevronDown, Truck, Package, ShieldCheck, CreditCard, Percent } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";

export function ProductClient({ 
  product, 
  variants = [], 
  relatedProducts = [] 
}: { 
  product: any; 
  variants?: any[]; 
  relatedProducts?: any[]; 
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  
  // E-commerce states
  const [activeAccordion, setActiveAccordion] = useState<string | null>("description");
  const [zipCode, setZipCode] = useState("");
  const [shippingResult, setShippingResult] = useState<string | null>(null);

  const { addItem, setIsOpen } = useCart();

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error("Error loading settings in product client:", err));
  }, []);

  const whatsappPhoneId = settings ? settings.web_store_whatsapp_id : WHATSAPP_PHONE;
  const cashDiscount = settings && settings.web_promo_cash_discount && !isNaN(Number(settings.web_promo_cash_discount)) ? Number(settings.web_promo_cash_discount) : 15;
  const installmentsText = settings ? settings.web_promo_installments : "6 cuotas sin interés";

  const images = product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
    ? product.imagenesCatalogo.map((key: string) => resolveStorageUrl(key)).filter(Boolean)
    : (product.mockImage ? [product.mockImage] : []);

  const getThumbnailLabel = (index: number) => {
    if (images[index]) {
      return (
        <Image 
          src={images[index]} 
          alt={`Vista ${index + 1}`} 
          fill 
          className="object-cover p-1 rounded-full" 
        />
      );
    }
    return <Camera className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white font-sans">
      <StorefrontNavbar theme="light" />
      
      <div className="flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0">
        
        <div className="w-full lg:w-[60%] bg-white relative flex items-center justify-center p-0 lg:p-12 min-h-[50vh] lg:h-screen lg:sticky lg:top-0 border-r border-[#e5e5e5] overflow-hidden group">
          
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
                  title={idx === 0 ? "Ver producto" : "Virtual Try-On"}
                >
                  {getThumbnailLabel(idx)}
                </button>
              ))}
            </div>
          )}

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-[85%] aspect-square relative bg-[#fdfdfd] border border-[#f0f0f0] shadow-sm flex items-center justify-center"
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
                  <Image 
                    src={images[activeImageIndex]} 
                    alt={`${product.brand} ${product.model}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 85vw"
                    style={{ objectFit: activeImageIndex === 0 ? "contain" : "cover", transform: "translateZ(0)" }}
                    className={activeImageIndex === 0 ? (((product.model || '').toLowerCase().includes('tl3932 c3') || (product.model || '').toLowerCase().includes('diana') || product.id === 'cmq5d11hf002rhy61fhvqs7nj') ? "p-0 scale-125" : "p-8 lg:p-12") : ""}
                  />
                </motion.div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-black uppercase tracking-widest relative z-10">
                  Sin Imagen
                </div>
              )}
            </AnimatePresence>
            
            {activeImageIndex > 0 && (
              <div className="absolute top-6 right-6 z-20 bg-black/50 backdrop-blur-md text-white text-[10px] font-mono tracking-widest uppercase px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                AI Try-On
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
              by {product.brand}
            </motion.p>
            
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
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-2.5">
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
                            <Image
                              src={resolveStorageUrl(v.imageUrl)}
                              alt={v.colorCode}
                              fill
                              sizes="32px"
                              style={{ objectFit: 'contain' }}
                              className="transition-transform duration-300 group-hover:scale-110"
                            />
                          </div>
                        ) : (
                          <span className="text-[9px] font-mono font-bold uppercase px-2 py-1">
                            {v.colorCode}
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded shadow-sm border border-stone-100 whitespace-nowrap z-20 pointer-events-none">
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
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-2xl font-light tracking-tight text-black mb-6"
            >
              ${(product.price || 0).toLocaleString("es-AR")}
            </motion.p>
            
            <PaymentOptions 
              variant="inline" 
              price={product.price || 0} 
              cashDiscount={cashDiscount} 
              installmentsText={installmentsText} 
            />

            <div className="flex flex-col gap-3 mb-6 mt-4">
              <button
                disabled={product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal" || isAdded}
                onClick={() => {
                  addItem({
                    productId: product.id,
                    brand: product.brand,
                    model: product.model,
                    price: product.price || 0,
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
                {isAdded ? "¡Ya son tuyos! 🎉" : ((product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal") ? "Agotado" : "¡Los Quiero!")}
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
                        <p className="text-sm font-serif italic text-[#666] leading-relaxed mb-6">
                          {product.description || `Anteojos de diseño ${product.category} modelo ${product.model} elaborados por ${product.brand}. Diseñados para brindar el mayor confort y estilo premium.`}
                        </p>
                        
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
                          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-[#999] hover:text-black transition-colors"
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
                        <div className="bg-[#f9f9f9] border border-[#e5e5e5] p-4 rounded-sm flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Tu código postal"
                            value={zipCode}
                            onChange={(e) => setZipCode(e.target.value)}
                            className="flex-1 bg-white border border-[#e5e5e5] px-3 py-2 text-xs font-mono outline-none focus:border-black transition-colors"
                            maxLength={8}
                          />
                          <button 
                            onClick={() => {
                              if (zipCode.length > 2) {
                                setShippingResult("calculated");
                              } else {
                                setShippingResult("invalid");
                              }
                            }}
                            className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                          >
                            Calcular
                          </button>
                        </div>
                        {shippingResult === "calculated" && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="mt-4 p-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs flex flex-col gap-3 rounded-lg"
                          >
                            <div className="flex gap-2 items-center font-bold text-black border-b border-stone-200 pb-2">
                              <Truck className="w-4 h-4 text-[#1b4332]" />
                              <span>Opciones de Envío Correo Argentino (Sin Cargo)</span>
                            </div>
                            
                            <div className="space-y-3.5 divide-y divide-stone-100">
                              <div className="flex flex-col gap-1 pt-1.5 first:pt-0">
                                <div className="flex justify-between items-baseline">
                                  <span className="font-bold text-stone-900">1. Envío a Domicilio</span>
                                  <span className="text-[10px] font-bold text-[#1b4332] bg-green-50 px-2 py-0.5 rounded-sm">GRATIS</span>
                                </div>
                                <p className="text-[11px] text-stone-600 mt-1">
                                  Llega a tu domicilio en <strong>3 a 5 días hábiles</strong> desde que se despacha.
                                </p>
                              </div>

                              <div className="flex flex-col gap-1 pt-3">
                                <div className="flex justify-between items-baseline">
                                  <span className="font-bold text-stone-900">2. Envío a Sucursal Oficial</span>
                                  <span className="text-[10px] font-bold text-[#1b4332] bg-green-50 px-2 py-0.5 rounded-sm">GRATIS</span>
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
                          </motion.div>
                        )}
                        {shippingResult === "invalid" && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-red-500 text-xs">
                            Por favor, ingresá un código postal válido.
                          </motion.div>
                        )}
                        <p className="text-[10px] text-stone-500 mt-4 leading-relaxed">
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

          <div className="p-8 lg:p-14 flex-1 flex flex-col justify-end gap-3">
            
            {/* Sellos de Confianza (Trust Badges) - Movidos debajo del carrito */}
            <div className="my-2 py-3 border-y border-[#e5e5e5]/50 grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center text-center p-1">
                <ShieldCheck className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-wider text-stone-800">Garantía</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <CreditCard className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-wider text-stone-800">6 Cuotas</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Truck className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-wider text-stone-800">Envío Gratis</span>
              </div>
              <div className="flex flex-col items-center text-center p-1">
                <Percent className="w-4 h-4 text-stone-700 mb-1" />
                <span className="text-[8px] font-black uppercase tracking-wider text-stone-800">15% OFF</span>
              </div>
            </div>
            
            <button
              onClick={() => setShowConfigurator(true)}
              className="w-full border border-[#e5e5e5] bg-white text-black px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:border-black transition-colors shadow-sm"
            >
              + Agregar Cristales Con Receta
            </button>

            {images.length > 1 && (
              <div className="flex gap-2 w-full mt-2">
                {images.length === 2 ? (
                  <button
                    onClick={() => setActiveImageIndex(activeImageIndex === 0 ? 1 : 0)}
                    className={`w-full py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 rounded-sm border ${
                      activeImageIndex > 0 
                        ? 'bg-[#c8a55c] text-white border-[#c8a55c] hover:bg-[#b08f4c]' 
                        : 'border-[#c8a55c] text-[#c8a55c] bg-white hover:bg-[#c8a55c]/5'
                    }`}
                  >
                    <User className="w-4 h-4" /> 
                    {activeImageIndex > 0 ? "Ver Foto de Producto" : "✨ Probar con IA (Virtual Try-On)"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveImageIndex(activeImageIndex === 1 ? 0 : 1)}
                      className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 rounded-sm border ${
                        activeImageIndex === 1 
                          ? 'bg-[#c8a55c] text-white border-[#c8a55c] hover:bg-[#b08f4c]' 
                          : 'border-stone-200 text-stone-700 bg-white hover:border-[#c8a55c] hover:text-[#c8a55c]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      {activeImageIndex === 1 ? "Ver Foto" : "✨ Probar Hombre"}
                    </button>
                    <button
                      onClick={() => setActiveImageIndex(activeImageIndex === 2 ? 0 : 2)}
                      className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 rounded-sm border ${
                        activeImageIndex === 2 
                          ? 'bg-[#c8a55c] text-white border-[#c8a55c] hover:bg-[#b08f4c]' 
                          : 'border-stone-200 text-stone-700 bg-white hover:border-[#c8a55c] hover:text-[#c8a55c]'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {activeImageIndex === 2 ? "Ver Foto" : "✨ Probar Mujer"}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-3">
              <a 
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(`¡Hola! Quiero comprar el anteojo ${product.brand || ''} ${product.model || ''} por $${(product.price || 0).toLocaleString("es-AR")}. ¿Me pasarían los datos para transferencia/link de pago?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-stone-500 font-bold uppercase tracking-widest hover:text-[#1b4332] transition-colors flex items-center justify-center gap-1.5 underline underline-offset-4"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-current" /> Comprar directo por WhatsApp
              </a>

              <a 
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(`¡Hola! Tengo una consulta sobre el modelo ${product.brand || ''} ${product.model || ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-stone-400 font-bold uppercase tracking-widest hover:text-black transition-colors flex items-center justify-center gap-1.5"
              >
                Consultar dudas por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts && relatedProducts.length > 0 && (
        <div className="px-8 lg:px-14 pb-12 bg-white">
          <div className="border-t border-[#e5e5e5] pt-12">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-black mb-6">Productos que te pueden interesar</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedProducts.map((p, idx) => (
                <Link 
                  key={idx} 
                  href={`/producto/${p.slug}`}
                  className="group block bg-white border border-[#f0f0f0] hover:border-stone-300 p-4 transition-all duration-300 rounded-lg"
                >
                  <div className="aspect-square relative overflow-hidden bg-stone-50 mb-3 rounded-md">
                    <Image 
                      src={resolveStorageUrl(p.imageUrl)} 
                      alt={`${p.brand} ${p.model}`} 
                      fill 
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                  <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">{p.brand}</p>
                  <h4 className="text-xs font-bold text-stone-900 truncate uppercase mt-0.5">{p.model}</h4>
                  <p className="text-xs text-stone-600 font-medium mt-1">
                    ${(p.price || 0).toLocaleString("es-AR")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <StorefrontFooter />

      <FloatingWhatsApp productName={`${product.brand} ${product.model}`} />

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
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-black hover:bg-stone-200 rounded-full transition-colors z-20"
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
