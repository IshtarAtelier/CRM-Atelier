"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/store/useCart";
import { WHATSAPP_PHONE } from "@/lib/constants";

type LensType = "MONOFOCAL" | "BIFOCAL" | "MULTIFOCAL" | "NONE" | null;
type Treatment = "ORGANICO_BLANCO" | "ORGANICO_AR" | "ORGANICO_BLUE" | "POLI_BLUE" | "ORGANICO_FOTOCROMATICO" | "ORGANICO_BLANCO_TENIDO" | "SMART_FREE" | "VARILUX" | "FOTOCROMATICO" | "UNICO" | null;

interface ConfiguratorProps {
  basePrice: number;
  productId?: string;
  category?: string;
  onColorChange?: (hex: string | null) => void;
  productInfo?: { brand: string; model: string; image: string };
  cartItemId?: string;
  onSuccess?: () => void;
  onStepChange?: (step: number) => void;
}

export function LensConfigurator({ basePrice, productId, category, onColorChange, productInfo, cartItemId, onSuccess, onStepChange }: ConfiguratorProps) {
  const [webSettings, setWebSettings] = useState({
    web_promo_cash_discount: 15,
    web_promo_installments: "6 cuotas sin interés"
  });

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
      .catch(err => console.error("Error loading web settings for configurator:", err));
  }, []);

  const getInstallmentsCount = (text: string) => {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 6;
  };

  const installmentsCount = getInstallmentsCount(webSettings.web_promo_installments);
  const discountRate = webSettings.web_promo_cash_discount / 100;

  const [step, setStep] = useState<number>(1);
  const [lensType, setLensType] = useState<LensType>(null);
  const [treatment, setTreatment] = useState<Treatment>(null);
  const [tintColor, setTintColor] = useState<string | null>(null);
  const [tintStyle, setTintStyle] = useState<"COMPACTO" | "DEGRADÉ" | "SEGÚN MUESTRA" | null>(null);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [sendLater, setSendLater] = useState<boolean>(false);
  const [dynamicPricing, setDynamicPricing] = useState<any>(null);
  const { addItem, updateItemLensConfig } = useCart();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onStepChange) {
      onStepChange(step);
    }
  }, [step, onStepChange]);

  const [flowType, setFlowType] = useState<"SUN" | "CLEAR">(category === "Anteojos de Sol" ? "SUN" : "CLEAR");

  // Load pricing on mount
  useEffect(() => {
    fetch('/api/web/pricing')
      .then(res => res.json())
      .then(data => {
        if (!data.error && data.MONOFOCAL) {
          setDynamicPricing(data);
        }
      })
      .catch(console.error);
  }, []);

  const PRICING = dynamicPricing || {
    MONOFOCAL: { ORGANICO_BLANCO: 20000, ORGANICO_AR: 45000, ORGANICO_BLUE: 68000, POLI_BLUE: 120000, ORGANICO_FOTOCROMATICO: 105000, ORGANICO_BLANCO_TENIDO: 68000 },
    BIFOCAL: { ORGANICO_BLANCO: 45000 },
    MULTIFOCAL: { SMART_FREE: 120000, VARILUX: 350000, FOTOCROMATICO: 180000 },
    EXTRAS: { TINT: 25000 },
  };

  const calculateTotal = () => {
    let total = basePrice;
    
    if (flowType === "SUN" && tintColor && tintStyle) {
      // SUN FLOW: All lenses are base "Organico Blanco" (or Smart Free for Multifocal) + TINT
      if (lensType === "NONE") total += (PRICING.MONOFOCAL.ORGANICO_BLANCO || 0);
      if (lensType === "MONOFOCAL") total += (PRICING.MONOFOCAL.ORGANICO_BLANCO || 0);
      if (lensType === "BIFOCAL") total += (PRICING.BIFOCAL.ORGANICO_BLANCO || 0);
      if (lensType === "MULTIFOCAL") total += (PRICING.MULTIFOCAL.SMART_FREE || 0);
      
      // Teñido applies to all configured vision options in the sun flow
      if (lensType !== null) {
        total += PRICING.EXTRAS.TINT;
      }
    } else {
      // CLEAR FLOW
      if (lensType === "MONOFOCAL" && treatment) {
        total += PRICING.MONOFOCAL[treatment as keyof typeof PRICING.MONOFOCAL] || 0;
      }
      if (lensType === "BIFOCAL" && treatment) {
        total += PRICING.BIFOCAL.ORGANICO_BLANCO;
      }
      if (lensType === "MULTIFOCAL" && treatment) {
        total += PRICING.MULTIFOCAL[treatment as keyof typeof PRICING.MULTIFOCAL] || 0;
      }
    }
    
    return total;
  };

  const mapColorToHex = (colorName: string | null) => {
    if (!colorName) return null;
    if (colorName.includes("Gris")) return "#555555";
    if (colorName.includes("Marrón")) return "#6b4c3a";
    if (colorName.includes("Verde")) return "#2c4c3b";
    if (colorName.includes("Rosa")) return "#d4a3a3";
    if (colorName.includes("Amarillo")) return "#e1b854";
    if (colorName.includes("Naranja")) return "#d6804a";
    if (colorName.includes("Rojo")) return "#ab4040";
    return null;
  };

  return (
    <div className="w-full text-black">
      <div className="flex justify-between items-end mb-12">
        <h3 className="text-2xl font-serif uppercase tracking-tight">Armá tus lentes</h3>
      </div>

      {/* BLOQUE DE ASESORAMIENTO */}
      <div className="mb-12 border-b border-black/10 pb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#999]">Asistencia Personalizada</span>
          <a href={`https://wa.me/${WHATSAPP_PHONE}?text=Hola,%20necesito%20asesoramiento%20para%20elegir%20mis%20cristales.`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase tracking-[0.15em] text-black hover:text-[#666] transition-colors flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </div>
            Tengo dudas
            <svg className="w-3.5 h-3.5 fill-current text-emerald-650 ml-0.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </a>
        </div>
      </div>

      {flowType === "CLEAR" && category !== "Anteojos de Sol" && (
        <div role="button" tabIndex={0} className="relative overflow-hidden mb-8 p-6 bg-stone-900 text-white rounded-[1rem] flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:bg-black transition-colors shadow-xl shadow-stone-900/10 group" onClick={() => { setFlowType("SUN"); setStep(1); setLensType(null); setTreatment(null); setTintColor(null); setTintStyle(null); }}>
          {/* Brillo móvil infinito (Shimmer) */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
          
          <div className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-[12px] uppercase tracking-[0.2em] font-bold mb-1 flex items-center gap-2">☀️ Hacelos de Sol</h4>
              <p className="text-[11px] font-serif italic text-white/80">Elegí el color del cristal y encargá tus anteojos de sol con tu graduación.</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white text-black px-4 py-2 rounded-full whitespace-nowrap hover:scale-105 transition-transform shadow-lg shadow-white/20">Ver Colores →</span>
          </div>
        </div>
      )}

      {flowType === "SUN" && category !== "Anteojos de Sol" && (
        <div role="button" tabIndex={0} className="mb-8 p-4 border border-black/10 rounded-[1rem] flex flex-col sm:flex-row items-center justify-between cursor-pointer hover:bg-black/5 transition-colors" onClick={() => { setFlowType("CLEAR"); setStep(1); setLensType(null); setTreatment(null); setTintColor(null); setTintStyle(null); }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-black flex items-center gap-3"><span className="text-xl">👓</span> Volver a cristales transparentes</p>
          <span className="text-[10px] uppercase tracking-widest underline underline-offset-4 mt-2 sm:mt-0 font-bold">Cambiar</span>
        </div>
      )}

      {flowType === "SUN" ? (
        <>
          {/* ====== FLUJO DE SOL ====== */}
          
          {/* PASO 1: COLOR DEL CRISTAL */}
          <motion.div animate={{ opacity: step < 1 ? 0.5 : 1 }} className="mb-8">
            {step > 1 ? (
              <CompletedStep num="01" subtitle="Color" title={tintColor || "Elegir"} onClick={() => {setStep(1); setTintStyle(null); setLensType(null);}} />
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">01 / Color del Cristal</p>
                  <p className="text-sm font-serif italic text-black">Seleccioná el tinte para proteger tu vista con estilo.</p>
                </div>
                <div className="flex flex-wrap gap-4 mt-6">
                  <ColorOption color="Gris" hex="#555555" selected={tintColor === "Gris"} onClick={() => { setTintColor("Gris"); if (onColorChange) onColorChange("#555555"); setStep(2); }} />
                  <ColorOption color="Marrón" hex="#6b4c3a" selected={tintColor === "Marrón"} onClick={() => { setTintColor("Marrón"); if (onColorChange) onColorChange("#6b4c3a"); setStep(2); }} />
                  <ColorOption color="Verde G15" hex="#2c4c3b" selected={tintColor === "Verde G15"} onClick={() => { setTintColor("Verde G15"); if (onColorChange) onColorChange("#2c4c3b"); setStep(2); }} />
                  <ColorOption color="Rosa" hex="#d4a3a3" selected={tintColor === "Rosa"} onClick={() => { setTintColor("Rosa"); if (onColorChange) onColorChange("#d4a3a3"); setStep(2); }} />
                  <ColorOption color="Amarillo" hex="#e1b854" selected={tintColor === "Amarillo"} onClick={() => { setTintColor("Amarillo"); if (onColorChange) onColorChange("#e1b854"); setStep(2); }} />
                  <ColorOption color="Naranja" hex="#d6804a" selected={tintColor === "Naranja"} onClick={() => { setTintColor("Naranja"); if (onColorChange) onColorChange("#d6804a"); setStep(2); }} />
                  <ColorOption color="Rojo" hex="#ab4040" selected={tintColor === "Rojo"} onClick={() => { setTintColor("Rojo"); if (onColorChange) onColorChange("#ab4040"); setStep(2); }} />
                </div>
              </>
            )}
          </motion.div>

          {/* PASO 2: ESTILO DE TEÑIDO */}
          <AnimatePresence>
            {step >= 2 && tintColor && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
                {step > 2 ? (
                  <CompletedStep num="02" subtitle="Estilo" title={tintStyle || ""} onClick={() => {setStep(2); setLensType(null);}} />
                ) : (
                  <>
                    <div className="mb-6 mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">02 / Estilo de Teñido</p>
                      <p className="text-sm font-serif italic text-black">Elegí la forma en que se aplicará el color en tu lente.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <OptionCard selected={tintStyle === "COMPACTO"} onClick={() => { setTintStyle("COMPACTO"); setStep(3); }} title="Compacto" desc="Color uniforme en todo el lente." />
                      <OptionCard selected={tintStyle === "DEGRADÉ"} onClick={() => { setTintStyle("DEGRADÉ"); setStep(3); }} title="Degradé" desc="Más oscuro arriba y claro abajo." />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* PASO 3: AUMENTO (OPCIONAL) */}
          <AnimatePresence>
            {step >= 3 && tintStyle && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
                {step > 3 ? (
                  <CompletedStep num="03" subtitle="Visión" title={lensType === "NONE" ? "Sin Aumento" : lensType || ""} onClick={() => setStep(3)} />
                ) : (
                  <>
                    <div className="mb-6 mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">03 / Visión</p>
                      <p className="text-sm font-serif italic text-black">Podés hacer que tus anteojos de sol tengan tu receta.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      <OptionCard 
                        selected={lensType === "NONE"} 
                        onClick={() => { setLensType("NONE"); setTreatment("ORGANICO_BLANCO"); setStep(4); }} 
                        title="Sin Aumento" 
                        desc="Orgánico Blanco neutro + Teñido." 
                      />
                      <OptionCard 
                        selected={lensType === "MONOFOCAL"} 
                        onClick={() => { setLensType("MONOFOCAL"); setTreatment("ORGANICO_BLANCO"); setStep(4); }} 
                        title="Monofocal Teñido" 
                        desc="Orgánico Blanco para lejos o cerca." 
                      />
                      <OptionCard 
                        selected={lensType === "BIFOCAL"} 
                        onClick={() => { setLensType("BIFOCAL"); setTreatment("ORGANICO_BLANCO"); setStep(4); }} 
                        title="Bifocal Teñido" 
                        desc="Visión dividida para lejos y cerca." 
                      />
                      <OptionCard 
                        selected={lensType === "MULTIFOCAL"} 
                        onClick={() => { setLensType("MULTIFOCAL"); setTreatment("SMART_FREE"); setStep(4); }} 
                        title="Multifocal Teñido" 
                        desc="Visión progresiva para todas las distancias." 
                      />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <>
          {/* ====== FLUJO DE RECETA (DEFAULT CLEAR) ====== */}
          
          {/* PASO 1: TIPO DE CRISTAL */}
          <motion.div animate={{ opacity: step < 1 ? 0.5 : 1 }} className="mb-8">
            {step > 1 ? (
              <CompletedStep num="01" subtitle="Tipo de Visión" title={lensType || ""} onClick={() => setStep(1)} />
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">01 / Tipo de Visión</p>
                  <p className="text-sm font-serif italic text-black">Definí cómo vas a usar tus anteojos en el día a día.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <OptionCard selected={lensType === "MONOFOCAL"} onClick={() => { setLensType("MONOFOCAL"); setTreatment(null); setStep(2); }} title="Monofocal" desc="Diseñado para ver a una sola distancia (Lejos o Cerca)." />
                  <OptionCard selected={lensType === "MULTIFOCAL"} onClick={() => { setLensType("MULTIFOCAL"); setTreatment(null); setStep(2); }} title="Multifocal" desc="Para ver a todas las distancias sin cambiar de anteojos." />
                  <OptionCard selected={lensType === "BIFOCAL"} onClick={() => { setLensType("BIFOCAL"); setTreatment("UNICO"); setStep(2); }} title="Bifocal" desc="Visión dividida para lejos y cerca de forma tradicional." />
                  {!cartItemId && (
                    <OptionCard selected={lensType === "NONE"} onClick={() => { setLensType("NONE"); setTreatment(null); setTintColor(null); setTintStyle(null); setStep(4); }} title="Solo Armazón" desc="Llevar el armazón sin cristales con aumento." />
                  )}
                </div>
              </>
            )}
          </motion.div>

          {/* PASO 2: TRATAMIENTO */}
          <AnimatePresence>
            {step >= 2 && lensType && lensType !== "NONE" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-8 overflow-hidden">
                {step > 2 ? (
                  <CompletedStep num="02" subtitle="Tratamiento" title={treatment || ""} onClick={() => setStep(2)} />
                ) : (
                  <>
                    <div className="mb-6 mt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">02 / Calidad del Cristal</p>
                      <p className="text-sm font-serif italic text-black">Elegí el tratamiento ideal para cuidar tu vista.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                      {lensType === "MONOFOCAL" && (
                        <>
                          <OptionCard 
                            selected={treatment === "ORGANICO_BLANCO"} 
                            onClick={() => { setTreatment("ORGANICO_BLANCO"); setStep(4); }} 
                            title="Básico (Sin Protección)" 
                            features={["Visión estándar", "Sin Antirreflex", "Grosor normal"]} 
                            price={`+$${(PRICING.MONOFOCAL.ORGANICO_BLANCO || 0).toLocaleString('es-AR')}`}
                          />
                          <OptionCard 
                            selected={treatment === "ORGANICO_AR"} 
                            onClick={() => { setTreatment("ORGANICO_AR"); setStep(4); }} 
                            title="Antirreflex (Evita Brillos)" 
                            features={["Visión más nítida", "Sin reflejos molestos", "Mayor estética"]} 
                            price={`+$${(PRICING.MONOFOCAL.ORGANICO_AR || 0).toLocaleString('es-AR')}`}
                          />
                          <OptionCard 
                            selected={treatment === "ORGANICO_BLUE"} 
                            onClick={() => { setTreatment("ORGANICO_BLUE"); setStep(4); }} 
                            title="Super Blue" 
                            badge="MÁS ELEGIDO ⭐"
                            features={["Antirreflex Premium", "Filtro luz azul (Pantallas)", "20% más delgado"]} 
                            price={`+$${(PRICING.MONOFOCAL.ORGANICO_BLUE || 0).toLocaleString('es-AR')}`}
                          />
                          <OptionCard 
                            selected={treatment === "POLI_BLUE"} 
                            onClick={() => { setTreatment("POLI_BLUE"); setStep(4); }} 
                            title="Extra Fino y Resistente" 
                            badge="PREMIUM 👑"
                            features={["Policarbonato irrompible", "Filtro luz azul", "Ultra liviano"]} 
                            price={`+$${(PRICING.MONOFOCAL.POLI_BLUE || 0).toLocaleString('es-AR')}`}
                          />
                          <OptionCard 
                            selected={treatment === "ORGANICO_FOTOCROMATICO"} 
                            onClick={() => { setTreatment("ORGANICO_FOTOCROMATICO"); setStep(4); }} 
                            title="Fotocromático" 
                            features={["Se oscurece al sol", "Protección UV 100%", "Uso interior/exterior"]} 
                            price={`+$${(PRICING.MONOFOCAL.ORGANICO_FOTOCROMATICO || 0).toLocaleString('es-AR')}`}
                          />
                        </>
                      )}
                      
                      {lensType === "BIFOCAL" && (
                        <OptionCard selected={true} onClick={() => { setTreatment("ORGANICO_BLANCO"); setStep(4); }} title="Bifocal Estándar" desc="Cristal tradicional con línea divisoria." price={`+$${(PRICING.BIFOCAL.ORGANICO_BLANCO || 0).toLocaleString('es-AR')}`} />
                      )}

                      {lensType === "MULTIFOCAL" && (
                        <>
                          <OptionCard selected={treatment === "SMART_FREE"} onClick={() => { setTreatment("SMART_FREE"); setStep(4); }} title="Diseño Digital ONE" desc="Campo visual amplio y transición natural." price={`+$${(PRICING.MULTIFOCAL.SMART_FREE || 0).toLocaleString('es-AR')}`} />
                          <OptionCard selected={treatment === "VARILUX"} onClick={() => { setTreatment("VARILUX"); setStep(4); }} title="Varilux Premium" desc="La experiencia visual definitiva sin esfuerzo." price={`+$${(PRICING.MULTIFOCAL.VARILUX || 0).toLocaleString('es-AR')}`} />
                          <OptionCard selected={treatment === "FOTOCROMATICO"} onClick={() => { setTreatment("FOTOCROMATICO"); setStep(4); }} title="Multi Fotocromático" desc="Tecnología digital que se oscurece al sol." price={`+$${(PRICING.MULTIFOCAL.FOTOCROMATICO || 0).toLocaleString('es-AR')}`} />
                        </>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* PASO 4: RECETA E IA */}
      <AnimatePresence>
        {step >= 4 && lensType !== "NONE" && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-12 mt-4"
          >
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#999] mb-2">
                {flowType === "SUN" ? "04" : "03"} / {tintStyle === "SEGÚN MUESTRA" ? "Receta y Muestra" : "Tu Receta"}
              </p>
              <p className="text-sm font-serif italic text-black">
                {tintStyle === "SEGÚN MUESTRA" 
                  ? "Adjuntá la foto del color a igualar (y tu receta si llevan aumento)."
                  : "Adjuntá la receta de tu oftalmólogo para fabricarlos exactos."}
              </p>
            </div>
            
            <div 
              className={`relative border p-12 text-center transition-colors group overflow-hidden ${prescriptionFile ? 'border-green-500 bg-green-50 shadow-md' : 'border-dashed border-black/30 hover:border-black bg-white shadow-sm'} rounded-[1rem] cursor-pointer`}
            >
              <input 
                type="file" 
                accept="image/*,application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setPrescriptionFile(e.target.files[0]);
                  }
                }}
              />
              
              {!prescriptionFile ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-[#fafafa] border border-black/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-black/50"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  </div>
                  <h4 className="font-bold text-[14px] uppercase tracking-widest mb-2">
                    {tintStyle === "SEGÚN MUESTRA" ? "Subir Archivo" : "Subir Receta"}
                  </h4>
                  <p className="text-[11px] text-[#666] max-w-xs mx-auto leading-relaxed">
                    {tintStyle === "SEGÚN MUESTRA" 
                      ? "Subí la foto del color que querés que igualemos o tu receta."
                      : "Tomale una foto clara con el celular o subí el archivo PDF."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 shadow-inner scale-110">
                    <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <h4 className="font-bold text-[14px] uppercase tracking-widest text-green-800 mb-1">¡Archivo Cargado!</h4>
                  <p className="text-[11px] text-green-700/80 mb-4 max-w-[250px] truncate">{prescriptionFile.name}</p>
                  <span className="text-[10px] font-bold text-black/50 group-hover:text-black uppercase tracking-[0.2em] underline underline-offset-4 transition-colors relative z-20">
                    Cambiar archivo
                  </span>
                </div>
              )}
            </div>

            {/* Checkbox: Enviar por WhatsApp luego */}
            <div className="mt-4 flex items-start gap-3 bg-stone-50 border border-stone-200/60 p-4 rounded-xl hover:bg-stone-100/50 transition-colors">
              <input
                type="checkbox"
                id="sendPrescriptionLater"
                checked={sendLater}
                onChange={(e) => {
                  setSendLater(e.target.checked);
                  if (e.target.checked) {
                    setPrescriptionFile(null); // Clear file if sending later
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-[#e5e5e5] text-black focus:ring-black cursor-pointer"
              />
              <label htmlFor="sendPrescriptionLater" className="text-xs text-stone-700 cursor-pointer select-none leading-relaxed text-left">
                <strong>Prefiero enviar {tintStyle === "SEGÚN MUESTRA" ? "la muestra/receta" : "mi receta"} por WhatsApp luego.</strong>
                <span className="block text-[11px] text-stone-500 mt-0.5">
                  Podés finalizar la compra ahora y un asesor te contactará para pedírtela.
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-[1px] bg-black/10 my-10" />

      {/* TOTAL Y ACCIÓN */}
      <motion.div layout className="flex flex-col gap-6">
        {/* Resumen del Presupuesto / Desglose */}
        <div className="w-full bg-[#faf8f5] border border-[#e8e2db] rounded-2xl p-5 mb-2 shadow-sm text-left">
          <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-3 border-b border-[#e8e2db] pb-2">
            Desglose del Presupuesto
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Armazón de Diseño ({productInfo?.model || 'Modelo Seleccionado'}):</span>
              <span className="font-mono font-bold">${basePrice.toLocaleString('es-AR')}</span>
            </div>
            
            {flowType === "SUN" && tintColor && tintStyle && lensType ? (
              <>
                <div className="flex justify-between text-stone-600">
                  <span>
                    Cristales de Sol ({lensType === "NONE" ? "Sin Aumento" : lensType}):
                  </span>
                  <span className="font-mono font-bold">
                    ${(() => {
                      if (lensType === "NONE" || lensType === "MONOFOCAL") return (PRICING.MONOFOCAL.ORGANICO_BLANCO || 0);
                      if (lensType === "BIFOCAL") return (PRICING.BIFOCAL.ORGANICO_BLANCO || 0);
                      if (lensType === "MULTIFOCAL") return (PRICING.MULTIFOCAL.SMART_FREE || 0);
                      return 0;
                    })().toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Teñido de Cristal ({tintColor} - {tintStyle}):</span>
                  <span className="font-mono font-bold">
                    ${(PRICING.EXTRAS.TINT || 0).toLocaleString('es-AR')}
                  </span>
                </div>
              </>
            ) : null}

            {flowType === "CLEAR" && lensType && lensType !== "NONE" && (
              <div className="flex justify-between text-stone-600">
                <span>
                  Cristales ({lensType} {treatment ? `- ${treatment.replace(/_/g, ' ')}` : ''}):
                </span>
                <span className="font-mono font-bold">
                  ${(calculateTotal() - basePrice).toLocaleString('es-AR')}
                </span>
              </div>
            )}
            
            <div className="border-t border-[#e8e2db] pt-3 mt-1 flex justify-between font-bold text-stone-900 text-sm">
              <span>Total Estimado:</span>
              <span className="font-mono">${calculateTotal().toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

        <div className="w-full flex flex-col items-center mb-2">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#999] mb-2">Inversión Final</p>
          <motion.p 
            key={calculateTotal()}
            className="text-4xl font-serif tracking-tight"
          >
            ${calculateTotal().toLocaleString()}
          </motion.p>
          <div className="flex flex-col items-center gap-1 mt-3.5 text-center">
            <p className="text-[11px] font-bold text-stone-700">
              💳 {webSettings.web_promo_installments} de <span className="underline">${Math.round(calculateTotal() / installmentsCount).toLocaleString('es-AR')}</span>
            </p>
            <p className="text-[11px] font-bold text-[#9e7f65] bg-[#faf8f5] px-3.5 py-1 rounded-full border border-[#e8e2db] mt-0.5 shadow-sm">
              💵 ${Math.round(calculateTotal() * (1 - discountRate)).toLocaleString('es-AR')} en efectivo / transferencia <span className="text-[10px] font-black uppercase text-primary ml-1">({webSettings.web_promo_cash_discount}% OFF)</span>
            </p>
          </div>
        </div>
        
        <button 
          disabled={lensType !== "NONE" && !prescriptionFile && !sendLater}
          onClick={() => {
            const finalColorStr = flowType === "SUN" && tintColor && tintStyle 
              ? `${tintColor} (${tintStyle})` 
              : tintColor;

            if (cartItemId) {
              const additionalPrice = calculateTotal() - basePrice;
              updateItemLensConfig(cartItemId, {
                lensType,
                treatment,
                color: finalColorStr,
                prescriptionFile: prescriptionFile ? prescriptionFile.name : (sendLater ? "Enviar luego por WhatsApp" : null)
              }, additionalPrice);
              
              if (onSuccess) onSuccess();
            } else {
              if (!productInfo) return;
              addItem({
                productId: productId || "unknown",
                brand: productInfo.brand,
                model: productInfo.model,
                price: calculateTotal(),
                basePrice: basePrice,
                image: productInfo.image,
                lensColor: mapColorToHex(tintColor),
                lensConfig: {
                  lensType,
                  treatment,
                  color: finalColorStr,
                  prescriptionFile: prescriptionFile ? prescriptionFile.name : (sendLater ? "Enviar luego por WhatsApp" : null)
                },
                quantity: 1
              });
              if (onSuccess) onSuccess();
            }
          }}
          className="w-full py-5 bg-black text-white font-bold uppercase tracking-[0.2em] text-[12px] hover:bg-black/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-2 rounded-full shadow-lg"
        >
          <span>{cartItemId ? "Confirmar Cristales" : "Agregar al Carrito"}</span>
        </button>

        <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-[#999] text-center">Envío Asegurado sin cargo a todo el país</p>
      </motion.div>
    </div>
  );
}

function OptionCard({ selected, onClick, title, desc, price, badge, features }: any) {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`cursor-pointer border p-6 flex flex-col justify-between transition-all duration-500 min-h-[160px] rounded-[1rem] relative ${
        selected 
          ? 'bg-black border-black text-white shadow-2xl scale-[1.02] z-10' 
          : 'bg-white border-black/10 text-black hover:border-black/30 shadow-sm'
      } ${badge ? 'pt-8' : ''}`}
    >
      {badge && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#d4af37] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-md whitespace-nowrap z-20">
          {badge}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <h4 className={`text-[12px] uppercase tracking-[0.15em] font-bold ${selected ? 'text-white' : 'text-black'}`}>
          {title}
        </h4>
        {features ? (
           <ul className="text-[11px] space-y-1.5 mt-2">
             {features.map((f: string, i: number) => (
               <li key={i} className={`flex items-center gap-1.5 ${selected ? 'text-white/90' : 'text-stone-600'}`}>
                 <span className="text-[10px]">✓</span> {f}
               </li>
             ))}
           </ul>
        ) : (
          <p className={`text-[11px] font-serif italic leading-relaxed ${selected ? 'text-white/80' : 'text-[#888]'}`}>
            {desc}
          </p>
        )}
      </div>
      {price && (
        <p className={`text-[12px] font-bold tracking-widest mt-6 ${selected ? 'text-white' : 'text-black'}`}>
          {price}
        </p>
      )}
    </motion.div>
  );
}

function ColorOption({ color, hex, selected, onClick }: any) {
  return (
    <motion.div 
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`cursor-pointer group flex flex-col items-center gap-3 transition-all duration-300 p-4 rounded-[1rem] w-[90px] ${
        selected ? 'bg-black/5' : 'hover:bg-black/5 bg-white shadow-sm border border-black/5'
      }`}
    >
      <div 
        className={`w-12 h-12 rounded-full shadow-inner transition-transform duration-500 flex items-center justify-center ${selected ? 'scale-110 ring-4 ring-black/10' : 'scale-100 group-hover:scale-110'}`} 
        style={{ backgroundColor: hex }} 
      >
        {selected && (
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white drop-shadow-md"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        )}
      </div>
      <div className="text-center">
        <h4 className={`text-[9px] uppercase tracking-[0.15em] font-bold transition-colors ${selected ? 'text-black' : 'text-[#666]'}`}>
          {color}
        </h4>
      </div>
    </motion.div>
  );
}

function CompletedStep({ num, subtitle, title, onClick }: { num: string, subtitle: string, title: string, onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} className="flex flex-col sm:flex-row sm:items-center justify-between py-6 border-b border-black/10 cursor-pointer group hover:bg-black/5 px-6 -mx-6 transition-colors rounded-xl" onClick={onClick}>
      <div className="flex items-center gap-6">
        <span className="text-[12px] font-bold uppercase tracking-[0.3em] text-[#999] opacity-40">{num}</span>
        <div>
          <span className="text-[9px] text-[#999] uppercase tracking-[0.3em] block mb-1">{subtitle}</span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-black">{title}</span>
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-[0.2em] text-black underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity mt-4 sm:mt-0 font-bold">Modificar</span>
    </div>
  );
}
