"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type LensType = "MONOFOCAL" | "BIFOCAL" | "MULTIFOCAL" | null;
type Treatment = "BLANCO" | "AR" | "BLUE" | "SMART_FREE" | "VARILUX" | "UNICO" | null;

interface ConfiguratorProps {
  basePrice: number;
}

export function LensConfigurator({ basePrice }: ConfiguratorProps) {
  const [step, setStep] = useState<number>(1);
  const [lensType, setLensType] = useState<LensType>(null);
  const [treatment, setTreatment] = useState<Treatment>(null);
  const [hasTint, setHasTint] = useState<boolean>(false);
  const [showCheckout, setShowCheckout] = useState<boolean>(false);
  const [checkoutStep, setCheckoutStep] = useState<"FORM" | "PAYMENT" | "SUCCESS">("FORM");
  const [customerData, setCustomerData] = useState({ name: "", whatsapp: "" });

  const PRICING = {
    MONOFOCAL: { BLANCO: 20000, AR: 45000, BLUE: 65000 },
    BIFOCAL: { UNICO: 85000 },
    MULTIFOCAL: { SMART_FREE: 120000, VARILUX: 350000 },
    EXTRAS: { TINT: 15000 },
  };

  const calculateTotal = () => {
    let total = basePrice;
    if (lensType === "MONOFOCAL" && treatment) {
      total += PRICING.MONOFOCAL[treatment as keyof typeof PRICING.MONOFOCAL] || 0;
    }
    if (lensType === "BIFOCAL" && treatment) {
      total += PRICING.BIFOCAL.UNICO;
    }
    if (lensType === "MULTIFOCAL" && treatment) {
      total += PRICING.MULTIFOCAL[treatment as keyof typeof PRICING.MULTIFOCAL] || 0;
    }
    if (hasTint) {
      total += PRICING.EXTRAS.TINT;
    }
    return total;
  };

  return (
    <div className="w-full text-black">
      <h3 className="text-[13px] font-bold uppercase tracking-widest mb-6">Configurar Cristales</h3>

      {/* PASO 1: TIPO DE CRISTAL */}
      <motion.div 
        animate={{ opacity: step < 1 ? 0.5 : 1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">1. Tipo de Visión</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OptionCard 
            selected={lensType === "MONOFOCAL"} 
            onClick={() => { setLensType("MONOFOCAL"); setTreatment(null); setStep(2); }}
            title="Monofocal" 
            desc="Para ver de lejos o cerca." 
          />
          <OptionCard 
            selected={lensType === "BIFOCAL"} 
            onClick={() => { setLensType("BIFOCAL"); setTreatment("UNICO"); setStep(2); }}
            title="Bifocal" 
            desc="Lejos y cerca con línea." 
          />
          <OptionCard 
            selected={lensType === "MULTIFOCAL"} 
            onClick={() => { setLensType("MULTIFOCAL"); setTreatment(null); setStep(2); }}
            title="Multifocal" 
            desc="Lejos, intermedia y cerca." 
          />
        </div>
      </motion.div>

      {/* PASO 2: TRATAMIENTO */}
      <AnimatePresence>
        {step >= 2 && lensType && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">2. Calidad del Cristal</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lensType === "MONOFOCAL" && (
                <>
                  <OptionCard selected={treatment === "BLANCO"} onClick={() => { setTreatment("BLANCO"); setStep(3); }} title="Blanco Estándar" desc="Cristal básico." price={`+$${PRICING.MONOFOCAL.BLANCO.toLocaleString()}`} />
                  <OptionCard selected={treatment === "AR"} onClick={() => { setTreatment("AR"); setStep(3); }} title="Antirreflex (AR)" desc="Elimina reflejos." price={`+$${PRICING.MONOFOCAL.AR.toLocaleString()}`} />
                  <OptionCard selected={treatment === "BLUE"} onClick={() => { setTreatment("BLUE"); setStep(3); }} title="Filtro Azul" desc="Para pantallas." price={`+$${PRICING.MONOFOCAL.BLUE.toLocaleString()}`} />
                </>
              )}
              
              {lensType === "BIFOCAL" && (
                <OptionCard selected={true} onClick={() => setStep(3)} title="Bifocal Estándar" desc="Cristal tradicional." price={`+$${PRICING.BIFOCAL.UNICO.toLocaleString()}`} />
              )}

              {lensType === "MULTIFOCAL" && (
                <>
                  <OptionCard selected={treatment === "SMART_FREE"} onClick={() => { setTreatment("SMART_FREE"); setStep(3); }} title="Smart Free" desc="Multifocal digital." price={`+$${PRICING.MULTIFOCAL.SMART_FREE.toLocaleString()}`} />
                  <OptionCard selected={treatment === "VARILUX"} onClick={() => { setTreatment("VARILUX"); setStep(3); }} title="Varilux Premium" desc="Visión panorámica." price={`+$${PRICING.MULTIFOCAL.VARILUX.toLocaleString()}`} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PASO 3: EXTRAS */}
      <AnimatePresence>
        {step >= 3 && treatment && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">3. Toque Final</p>
            </div>
            <label className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors ${hasTint ? 'border-black bg-black text-white' : 'border-[#e5e5e5] hover:border-black bg-white text-black'}`}>
              <input 
                type="checkbox" 
                checked={hasTint} 
                onChange={(e) => { setHasTint(e.target.checked); setStep(4); }}
                className="hidden"
              />
              <div className="flex-1">
                <h4 className="font-bold text-[13px]">Teñido de Color</h4>
                <p className={`text-[12px] ${hasTint ? 'text-white/70' : 'text-[#666]'}`}>Transformá en lentes para el sol.</p>
              </div>
              <div className="font-bold text-[13px]">
                +${PRICING.EXTRAS.TINT.toLocaleString()}
              </div>
            </label>
            {!hasTint && (
               <button onClick={() => setStep(4)} className="mt-3 text-[10px] font-bold text-[#999] uppercase tracking-widest hover:text-black transition-colors underline underline-offset-4 decoration-1">Saltar este paso</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PASO 4: RECETA E IA */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">4. Receta Oftalmológica</p>
            </div>
            
            <div className="border border-[#e5e5e5] p-6 text-center hover:border-black transition-colors cursor-pointer group bg-[#f9f9f9]">
               <p className="font-bold text-[13px] mb-1">Subí una foto de tu receta</p>
               <p className="text-[11px] text-[#666] mb-4 max-w-xs mx-auto leading-relaxed">Nuestra IA verificará que los cristales coincidan perfectamente con tu diagnóstico médico.</p>
               <button className="px-6 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity">Cargar Foto</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full h-[1px] bg-[#e5e5e5] my-8" />

      {/* TOTAL Y ACCIÓN */}
      <motion.div layout className="flex flex-col gap-4">
        <div className="w-full flex justify-between items-center mb-2">
          <p className="text-[11px] uppercase tracking-widest font-bold">Total</p>
          <motion.p 
            key={calculateTotal()}
            className="text-[20px] font-medium"
          >
            ${calculateTotal().toLocaleString()}
          </motion.p>
        </div>
        
        <button 
          disabled={step < 4}
          onClick={() => setShowCheckout(true)}
          className="w-full py-4 bg-black text-white font-medium uppercase tracking-widest text-[11px] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          <span>Ir a Pagar</span>
        </button>

        <p className="text-[10px] uppercase font-bold tracking-widest text-[#999] mt-2 text-center">Envío sin cargo a todo el país</p>
      </motion.div>

      {/* MODAL DE CHECKOUT SIN FRICCIÓN */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={() => setShowCheckout(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white p-10 z-50 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowCheckout(false)}
                className="absolute top-6 right-6 text-black font-medium text-[20px]"
              >
                ✕
              </button>

              <h3 className="text-xl font-medium mb-6">Confirmar Pedido</h3>
              
              {checkoutStep === "FORM" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-[#666] mb-8 text-[13px] leading-relaxed">Por favor, dejanos tu WhatsApp. Nos comunicaremos al instante tras el pago para coordinar el envío gratuito.</p>
                  
                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#999] mb-2">Nombre y Apellido</label>
                      <input 
                        type="text" 
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        className="w-full bg-[#f2f2f2] border-none p-4 text-[13px] focus:ring-1 focus:ring-black outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#999] mb-2">WhatsApp</label>
                      <input 
                        type="tel" 
                        value={customerData.whatsapp}
                        onChange={(e) => setCustomerData({ ...customerData, whatsapp: e.target.value })}
                        className="w-full bg-[#f2f2f2] border-none p-4 text-[13px] focus:ring-1 focus:ring-black outline-none"
                      />
                    </div>
                  </div>

                  <button 
                    disabled={!customerData.name || !customerData.whatsapp}
                    onClick={() => setCheckoutStep("PAYMENT")}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-[11px] hover:opacity-80 transition-opacity disabled:opacity-30"
                  >
                    Continuar al Pago
                  </button>
                </div>
              )}

              {checkoutStep === "PAYMENT" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-[#666] mb-8 text-[13px]">Monto final a abonar: <strong className="text-black">${calculateTotal().toLocaleString()}</strong></p>
                  
                  <div className="space-y-3 mb-8">
                    <button onClick={() => setCheckoutStep("SUCCESS")} className="w-full p-4 border border-[#e5e5e5] hover:border-black transition-colors text-left flex justify-between items-center">
                      <span className="text-[13px] font-bold">MercadoPago</span>
                      <span className="text-[11px] text-[#999]">Tarjetas o dinero</span>
                    </button>

                    <button onClick={() => setCheckoutStep("SUCCESS")} className="w-full p-4 border border-[#e5e5e5] hover:border-black transition-colors text-left flex justify-between items-center">
                      <span className="text-[13px] font-bold">Transferencia</span>
                      <span className="text-[11px] text-[#999]">Banco</span>
                    </button>
                  </div>
                  
                  <button onClick={() => setCheckoutStep("FORM")} className="text-[10px] font-bold text-[#999] uppercase tracking-widest w-full text-center hover:text-black underline underline-offset-4 decoration-1">
                    Volver
                  </button>
                </div>
              )}

              {checkoutStep === "SUCCESS" && (
                <div className="animate-in zoom-in-95 duration-500 text-center py-6">
                  <div className="w-16 h-16 bg-black text-white flex items-center justify-center mx-auto mb-6">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-xl font-medium mb-4">Pedido Confirmado</h3>
                  <p className="text-[#666] mb-8 text-[13px] leading-relaxed">Recibimos tu orden y receta. Un asesor te escribirá a la brevedad a tu WhatsApp ({customerData.whatsapp}).</p>
                  
                  <button 
                    onClick={() => { setShowCheckout(false); setStep(1); setTreatment(null); setLensType(null); setCheckoutStep("FORM"); }}
                    className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest text-[11px] hover:opacity-80 transition-opacity"
                  >
                    Volver a la tienda
                  </button>
                </div>
              )}

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function OptionCard({ selected, onClick, title, desc, price }: any) {
  return (
    <motion.div 
      whileHover={{ scale: selected ? 1 : 1.02 }}
      onClick={onClick}
      className={`p-4 border cursor-pointer transition-colors duration-200 ${
        selected 
          ? 'border-black bg-black text-white' 
          : 'border-[#e5e5e5] hover:border-black bg-white text-black'
      }`}
    >
      <h4 className={`font-bold mb-1 text-[13px] ${selected ? 'text-white' : 'text-black'}`}>{title}</h4>
      <p className={`text-[11px] leading-relaxed mb-2 ${selected ? 'text-white/70' : 'text-[#666]'}`}>{desc}</p>
      {price && <p className={`text-[12px] font-bold ${selected ? 'text-white' : 'text-black'}`}>{price}</p>}
    </motion.div>
  );
}
