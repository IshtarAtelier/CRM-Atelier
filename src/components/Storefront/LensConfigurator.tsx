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
    <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-2xl border border-white/20 dark:border-stone-800/50 sticky top-8">
      <h3 className="text-2xl font-black mb-6 dark:text-white tracking-tight">Personalizá tus Lentes</h3>

      {/* PASO 1: TIPO DE CRISTAL */}
      <motion.div 
        animate={{ opacity: step < 1 ? 0.5 : 1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 rounded-full bg-stone-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-black">1</div>
          <p className="text-sm font-bold uppercase tracking-widest text-stone-900 dark:text-white">Tipo de Visión</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OptionCard 
            selected={lensType === "MONOFOCAL"} 
            onClick={() => { setLensType("MONOFOCAL"); setTreatment(null); setStep(2); }}
            title="Monofocal" 
            desc="Para ver de lejos O de cerca." 
          />
          <OptionCard 
            selected={lensType === "BIFOCAL"} 
            onClick={() => { setLensType("BIFOCAL"); setTreatment("UNICO"); setStep(2); }}
            title="Bifocal" 
            desc="Lejos y cerca con línea visible." 
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
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            className="mb-8 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className="w-6 h-6 rounded-full bg-stone-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-black">2</div>
              <p className="text-sm font-bold uppercase tracking-widest text-stone-900 dark:text-white">Calidad del Cristal</p>
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
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            className="overflow-hidden mb-8"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className="w-6 h-6 rounded-full bg-stone-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-black">3</div>
              <p className="text-sm font-bold uppercase tracking-widest text-stone-900 dark:text-white">Toque Final</p>
            </div>
            <label className="flex items-center gap-4 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 cursor-pointer transition-all hover:bg-stone-50 dark:hover:bg-stone-800/50 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-100 dark:via-stone-800 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              <input 
                type="checkbox" 
                checked={hasTint} 
                onChange={(e) => { setHasTint(e.target.checked); setStep(4); }}
                className="w-5 h-5 rounded text-stone-900 dark:text-stone-100 focus:ring-stone-900 relative z-10"
              />
              <div className="flex-1 relative z-10">
                <h4 className="font-bold dark:text-white">Teñido de Color</h4>
                <p className="text-xs text-stone-500">Transformá estos cristales en lentes para el sol.</p>
              </div>
              <div className="font-bold text-stone-900 dark:text-white relative z-10">
                +${PRICING.EXTRAS.TINT.toLocaleString()}
              </div>
            </label>
            {!hasTint && (
               <button onClick={() => setStep(4)} className="mt-3 text-xs font-bold text-stone-500 uppercase tracking-widest hover:text-stone-900 dark:hover:text-white transition-colors">Saltar este paso</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PASO 4: RECETA E IA */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
            className="overflow-hidden mb-8"
          >
            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className="w-6 h-6 rounded-full bg-stone-900 dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-black">4</div>
              <p className="text-sm font-bold uppercase tracking-widest text-stone-900 dark:text-white">Validación Clínica</p>
            </div>
            
            <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-8 text-center hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group">
               <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                 <svg className="w-6 h-6 text-stone-600 dark:text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
               </div>
               <p className="font-bold text-stone-900 dark:text-white mb-1">Subí una foto de tu receta</p>
               <p className="text-xs text-stone-500 mb-4 max-w-xs mx-auto">Nuestra Inteligencia Artificial verificará que los cristales que elegiste coincidan perfectamente con tu diagnóstico médico.</p>
               <button className="px-6 py-2 bg-stone-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-widest rounded-lg">Cargar Foto</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOTAL Y ACCIÓN */}
      <motion.div 
        layout
        className="mt-6 bg-stone-100 dark:bg-black p-6 rounded-2xl flex flex-col items-center justify-between gap-4 border border-stone-200 dark:border-stone-900"
      >
        <div className="w-full flex justify-between items-center mb-2">
          <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Inversión Final</p>
          <motion.p 
            key={calculateTotal()}
            initial={{ scale: 1.1, color: '#c8a55c' }}
            animate={{ scale: 1, color: 'inherit' }}
            className="text-3xl font-black text-stone-900 dark:text-white"
          >
            ${calculateTotal().toLocaleString()}
          </motion.p>
        </div>
        
        <button 
          disabled={step < 4}
          onClick={() => setShowCheckout(true)}
          className="w-full py-4 bg-[#c8a55c] text-white font-black uppercase tracking-widest text-sm rounded-xl hover:bg-[#b08e45] hover:scale-[1.02] transition-all shadow-2xl disabled:opacity-30 disabled:hover:scale-100 cursor-pointer disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          <span>Ir a Pagar y Confirmar</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400 mt-2 text-center">Envío Asegurado sin cargo a todo el país 🇦🇷</p>
      </motion.div>

      {/* MODAL DE CHECKOUT SIN FRICCIÓN */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowCheckout(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-8 z-50 border border-stone-200 dark:border-stone-800 max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowCheckout(false)}
                className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 dark:hover:text-white"
              >
                ✕
              </button>

              <h3 className="text-2xl font-black mb-2 dark:text-white">Falta muy poco</h3>
              
              {checkoutStep === "FORM" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-stone-500 mb-6 text-sm">Dejanos tu WhatsApp. Una vez que pagues, nos contactamos al instante para coordinar el envío gratis a tu domicilio.</p>
                  
                  <div className="space-y-4 mb-8">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Tu Nombre y Apellido</label>
                      <input 
                        type="text" 
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        placeholder="Ej: Sofía Martínez"
                        className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">WhatsApp</label>
                      <input 
                        type="tel" 
                        value={customerData.whatsapp}
                        onChange={(e) => setCustomerData({ ...customerData, whatsapp: e.target.value })}
                        placeholder="Ej: 351 123 4567"
                        className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-4 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <button 
                    disabled={!customerData.name || !customerData.whatsapp}
                    onClick={() => setCheckoutStep("PAYMENT")}
                    className="w-full py-4 bg-stone-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-sm rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    Continuar al Pago
                  </button>
                </div>
              )}

              {checkoutStep === "PAYMENT" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-stone-500 mb-6 text-sm">Elegí tu método de pago preferido para el total de <strong className="text-stone-900 dark:text-white">${calculateTotal().toLocaleString()}</strong>.</p>
                  
                  <div className="space-y-3 mb-6">
                    <button onClick={() => setCheckoutStep("SUCCESS")} className="w-full p-4 border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl flex items-center gap-4 transition-colors text-left group">
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-black">mp</div>
                      <div>
                        <h4 className="font-bold">MercadoPago</h4>
                        <p className="text-xs opacity-75">Tarjetas o dinero en cuenta</p>
                      </div>
                    </button>

                    <button onClick={() => setCheckoutStep("SUCCESS")} className="w-full p-4 border-2 border-stone-200 dark:border-stone-700 hover:border-stone-900 dark:hover:border-white rounded-2xl flex items-center gap-4 transition-colors text-left dark:text-white group">
                      <div className="bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-white w-10 h-10 rounded-full flex items-center justify-center font-black">🏦</div>
                      <div>
                        <h4 className="font-bold">Transferencia Bancaria</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400">Ver Alias / CBU</p>
                      </div>
                    </button>
                  </div>
                  
                  <button onClick={() => setCheckoutStep("FORM")} className="text-xs font-bold text-stone-400 uppercase tracking-widest w-full text-center hover:text-stone-900 dark:hover:text-white">
                    ← Volver
                  </button>
                </div>
              )}

              {checkoutStep === "SUCCESS" && (
                <div className="animate-in zoom-in-95 duration-500 text-center py-6">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-black mb-2 dark:text-white">¡Pedido Confirmado!</h3>
                  <p className="text-stone-500 mb-8 text-sm">Ya recibimos tu orden y tu foto de receta. En unos minutos te va a escribir un asesor a tu WhatsApp ({customerData.whatsapp}) para coordinar el envío de tus nuevos Atelier.</p>
                  
                  <button 
                    onClick={() => { setShowCheckout(false); setStep(1); setTreatment(null); setLensType(null); setCheckoutStep("FORM"); }}
                    className="w-full py-4 bg-stone-900 dark:bg-white text-white dark:text-black font-black uppercase tracking-widest text-sm rounded-xl hover:scale-[1.02] transition-all"
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
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-4 rounded-2xl border cursor-pointer transition-colors duration-200 ${
        selected 
          ? 'border-stone-900 dark:border-white bg-stone-900/5 dark:bg-white/10' 
          : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 bg-white/50 dark:bg-stone-900/50'
      }`}
    >
      <h4 className={`font-bold mb-1 ${selected ? 'text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>{title}</h4>
      <p className="text-xs text-stone-500 leading-tight mb-2">{desc}</p>
      {price && <p className={`text-sm font-bold ${selected ? 'text-stone-900 dark:text-white' : 'text-stone-400'}`}>{price}</p>}
    </motion.div>
  );
}
