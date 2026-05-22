import React from "react";
import { CreditCard, ShieldCheck } from "lucide-react";

export function CheckoutPaymentOptions({ formData, handleChange, isProcessing }: { formData: any, handleChange: any, isProcessing: boolean }) {
  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">3. Pago Seguro</h2>
      
      <div className="flex flex-col gap-3 mb-10">
        <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'PAYWAY' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
          <input type="radio" name="paymentMethod" value="PAYWAY" checked={formData.paymentMethod === 'PAYWAY'} onChange={handleChange} className="accent-black mt-1" />
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <p className="text-sm font-bold">Tarjeta de Crédito / Débito</p>
              <CreditCard className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed mb-2">Procesado de forma segura por Payway. Hasta 6 cuotas sin interés con tarjetas bancarias.</p>
            <div className="flex gap-1">
              <div className="h-4 w-6 bg-[#1434CB] rounded-[2px] opacity-80" /> {/* Visa Mock */}
              <div className="h-4 w-6 bg-[#EB001B] rounded-[2px] opacity-80" /> {/* MC Mock */}
              <div className="h-4 w-6 bg-[#00AEEF] rounded-[2px] opacity-80" /> {/* Amex Mock */}
            </div>
            
            {formData.paymentMethod === 'PAYWAY' && (
              <div className="mt-6 flex flex-col gap-4 p-5 border border-stone-100 bg-white" onClick={(e) => e.preventDefault()}>
                <div>
                  <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleChange} placeholder="Número de Tarjeta (Ej: 4500 1234 5678 9000)" maxLength={19} className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors font-mono tracking-widest" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input type="text" name="cardExp" value={formData.cardExp} onChange={handleChange} placeholder="Vencimiento (MM/AA)" maxLength={5} className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors font-mono tracking-widest text-center" />
                  </div>
                  <div className="flex-1">
                    <input type="password" name="cardCvc" value={formData.cardCvc} onChange={handleChange} placeholder="CVC (Ej: 123)" maxLength={4} className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors font-mono tracking-widest text-center" />
                  </div>
                </div>
                <div>
                  <input type="text" name="cardName" value={formData.cardName} onChange={handleChange} placeholder="Titular (Como figura en la tarjeta)" className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors uppercase" />
                </div>
                <div>
                  <select name="installments" value={formData.installments || "1"} onChange={handleChange} className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors bg-white">
                    <option value="1">1 pago sin interés</option>
                    <option value="3">3 Cuotas Fijas</option>
                    <option value="6">6 Cuotas Fijas (Cuota Simple)</option>
                    <option value="9">9 Cuotas Fijas</option>
                    <option value="12">12 Cuotas Fijas (Cuota Simple)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </label>
        
        <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'TRANSFER' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
          <input type="radio" name="paymentMethod" value="TRANSFER" checked={formData.paymentMethod === 'TRANSFER'} onChange={handleChange} className="accent-black mt-1" />
          <div className="flex-1">
            <p className="text-sm font-bold">Transferencia Bancaria (15% OFF)</p>
            <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Recibirás los datos bancarios al confirmar el pedido. El descuento se aplica sobre el total.</p>
          </div>
        </label>
      </div>

      <button 
        type="submit" 
        disabled={isProcessing}
        className="relative w-full bg-black text-white font-bold uppercase tracking-widest text-[11px] py-5 flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors disabled:bg-stone-800 disabled:opacity-80 overflow-hidden"
      >
        {isProcessing ? (
          <>
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando de forma segura...
            </span>
          </>
        ) : formData.paymentMethod === 'PAYWAY' ? (
          <>
            Pagar con Tarjeta <ShieldCheck className="w-4 h-4" />
          </>
        ) : (
          <>
            Confirmar Pedido <ShieldCheck className="w-4 h-4" />
          </>
        )}
      </button>
      
      <div className="flex items-center justify-center gap-2 text-[9px] text-stone-400 uppercase tracking-widest text-center mt-3">
        <ShieldCheck className="w-3 h-3" /> Transacción encriptada de 256-bits
      </div>
    </section>
  );
}
