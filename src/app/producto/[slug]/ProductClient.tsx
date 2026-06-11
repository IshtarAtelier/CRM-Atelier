"use client";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";

import { LensConfigurator } from "@/components/Storefront/LensConfigurator";
import { GlassesDiagram } from "@/components/Storefront/GlassesDiagram";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { PaymentOptions } from "@/components/Storefront/PaymentOptions";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, User, UserPlus, Share2, ChevronDown, Truck, Package, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useCart } from "@/store/useCart";
import { resolveStorageUrl } from "@/lib/utils/storage";

export function ProductClient({ product }: { product: any }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showConfigurator, setShowConfigurator] = useState(false);
  
  // E-commerce states
  const [activeAccordion, setActiveAccordion] = useState<string | null>("description");
  const [zipCode, setZipCode] = useState("");
  const [shippingResult, setShippingResult] = useState<string | null>(null);

  const { addItem, setIsOpen } = useCart();

  const images = product.imagenesCatalogo && product.imagenesCatalogo.length > 0 
    ? product.imagenesCatalogo.map((key: string) => resolveStorageUrl(key)).filter(Boolean)
    : (product.mockImage ? [product.mockImage] : []);

  const getThumbnailLabel = (index: number) => {
    if (index === 0) return <Camera className="w-4 h-4" />;
    if (index === 1) return <User className="w-4 h-4" />;
    if (index === 2) return <UserPlus className="w-4 h-4" />; 
    return <Camera className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <StorefrontNavbar mixBlend={true} />
      
      <div className="flex flex-col lg:flex-row min-h-screen pt-16 lg:pt-0">
        
        <div className="w-full lg:w-[60%] bg-white relative flex items-center justify-center p-0 lg:p-12 min-h-[50vh] lg:h-screen lg:sticky lg:top-0 border-r border-[#e5e5e5] overflow-hidden group">
          
          <div className="absolute inset-0 flex flex-col justify-center items-center opacity-[0.03] pointer-events-none overflow-hidden select-none">
            <div className="text-[15vw] leading-none font-bold tracking-tighter whitespace-nowrap">{product.brand}</div>
            <h2 className="text-[10vw] leading-none font-medium tracking-tight whitespace-nowrap">{product.model}</h2>
          </div>

          {images.length > 1 && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
              {images.map((_: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${
                    activeImageIndex === idx 
                      ? 'bg-black text-white border-black scale-110' 
                      : 'bg-white/50 text-stone-600 border-stone-200 hover:bg-white'
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
                  className={`absolute inset-0 z-10 isolate ${activeImageIndex === 0 ? 'mix-blend-multiply' : ''}`}
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
              className="flex flex-wrap items-center gap-3 mb-6"
            >
              {product.modelCode && (
                <span className="text-[10px] text-stone-500 font-bold bg-amber-50 border border-amber-200/50 px-2 py-1 rounded-sm">
                  Código Interno: {product.modelCode}
                </span>
              )}
              <span className="text-[10px] text-stone-400 font-mono bg-stone-100 px-2 py-1 rounded-sm">
                SKU: {product.id?.substring(0, 8).toUpperCase() || 'ATELIER'}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-2 py-1 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                En Stock
              </span>
            </motion.div>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-2xl font-light tracking-tight text-black mb-6"
            >
              ${(product.price || 0).toLocaleString("es-AR")}
            </motion.p>
            
            <PaymentOptions variant="inline" price={product.price || 0} />
            
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
                                setShippingResult(`¡Envío Gratis vía Correo Argentino! Llega en aprox. 3 a 5 días hábiles a tu domicilio.`);
                              } else {
                                setShippingResult("Ingresá un código postal válido.");
                              }
                            }}
                            className="bg-black text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                          >
                            Calcular
                          </button>
                        </div>
                        {shippingResult && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 p-3 bg-green-50 border border-green-200 text-green-800 text-xs flex gap-2 items-start">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>{shippingResult}</p>
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
            <button
              disabled={product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal"}
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
              }}
              className="w-full bg-black text-white px-8 py-5 text-[13px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {(product.stock !== undefined && product.stock <= 0 && product.category !== "Cristal") ? "Agotado" : "Agregar al Carrito"}
            </button>
            
            <button
              onClick={() => setShowConfigurator(true)}
              className="w-full border border-[#e5e5e5] bg-white text-black px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:border-black transition-colors"
            >
              + Agregar Cristales Con Receta
            </button>

            {images.length > 1 && (
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
            )}

            <a 
              href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`¡Hola! Tengo una consulta sobre el modelo ${product.brand || ''} ${product.model || ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full border border-[#e5e5e5] bg-[#f9f9f9] text-[#666] px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:border-black hover:text-black transition-colors flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-4 h-4" /> Consultar por WhatsApp
            </a>
            
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#999] mt-2 text-center">Envío sin cargo a todo el país</p>
          </div>
          
          <StorefrontFooter />
        </div>
      </div>

      <FloatingWhatsApp />

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
