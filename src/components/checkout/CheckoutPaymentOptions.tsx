import React from "react";
import { ShieldCheck } from "lucide-react";

export function CheckoutPaymentOptions({ formData, handleChange, isProcessing, webSettings, paywayLoaded, isWholesale }: { formData: any, handleChange: any, isProcessing: boolean, webSettings?: { web_promo_cash_discount: number, web_promo_installments: string }, paywayLoaded?: boolean, isWholesale?: boolean }) {
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    handleChange({ target: { name: 'cardNumber', value: formatted } });
  };

  const handleCardExpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    handleChange({ target: { name: 'cardExp', value: val } });
  };

  const getBorderColor = (value: string, minLength: number) => {
    if (!value || value.length === 0) return "border-stone-200 focus:border-black";
    if (value.replace(/\D/g, '').length >= minLength || value.length >= minLength) return "border-emerald-500 focus:border-emerald-600 bg-emerald-50/20";
    return "border-stone-200 focus:border-black";
  };
  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">3. Pago Seguro</h2>
      
      {isWholesale ? (
        <div className="flex flex-col gap-3 mb-10 animate-in fade-in">
          <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'TRANSFER_MAYORISTA' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="TRANSFER_MAYORISTA" checked={formData.paymentMethod === 'TRANSFER_MAYORISTA'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <p className="text-sm font-bold">Transferencia Bancaria</p>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Recibirás los datos bancarios al confirmar el pedido. Pago en su totalidad por transferencia (sin cuotas).</p>
            </div>
          </label>
          
          <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'ACORDAR_MAYORISTA' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="ACORDAR_MAYORISTA" checked={formData.paymentMethod === 'ACORDAR_MAYORISTA'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <p className="text-sm font-bold">A convenir</p>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Pago en dos entregas a acordar con el vendedor.</p>
            </div>
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-10">
          <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'PAYWAY' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="PAYWAY" checked={formData.paymentMethod === 'PAYWAY'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1 gap-2 flex-wrap">
                <p className="text-sm font-bold">Tarjeta de Crédito / Débito</p>
                <span className="text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-1">{webSettings?.web_promo_installments || "6 cuotas sin interés"}</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed mb-2">Procesado de forma segura por Payway. {webSettings?.web_promo_installments ? `Promo: ${webSettings.web_promo_installments}` : "Hasta 6 cuotas sin interés"} con tarjetas bancarias.</p>
              
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-400 mr-1">Aceptamos:</span>
                <div className="h-6 px-2.5 bg-[#1434CB] text-white rounded font-mono font-bold text-[9px] flex items-center justify-center tracking-tighter shadow-sm select-none">
                  VISA
                </div>
                <div className="h-6 px-2.5 bg-stone-900 text-white rounded flex items-center gap-1 font-mono font-bold text-[9px] shadow-sm select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EB001B] -mr-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5F00]" />
                  MC
                </div>
                <div className="h-6 px-2 bg-[#005B94] text-white rounded font-mono font-bold text-[9.5px] flex items-center justify-center uppercase tracking-tight shadow-sm select-none">
                  Cabal
                </div>
                <div className="h-6 px-2 bg-[#5d2e8c] text-white rounded font-sans font-black text-[9px] flex items-center justify-center uppercase tracking-widest shadow-sm select-none">
                  Payway
                </div>
              </div>

              <div className="mt-4 p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-3 select-none">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-stone-900 block">
                    Conexión 100% Encriptada
                  </span>
                  <span className="text-[10px] text-stone-500 block leading-relaxed">
                    Tus datos se procesan mediante la pasarela segura oficial de <strong>Payway (Prisma Medios de Pago)</strong> con cifrado SSL.
                  </span>
                </div>
              </div>
              
              {formData.paymentMethod === 'PAYWAY' && (
                <div role="button" tabIndex={0} className="mt-6 flex flex-col gap-4 p-5 border border-stone-100 bg-white" onClick={(e) => e.stopPropagation()}>
                  {/* Tipo de tarjeta: Payway exige un código distinto para débito y crédito */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange({ target: { name: 'cardType', value: 'CREDIT' } })}
                      className={`flex-1 p-3 text-xs font-black uppercase tracking-widest border transition-colors ${(formData.cardType || 'CREDIT') === 'CREDIT' ? 'border-black bg-black text-white' : 'border-stone-200 text-stone-400 hover:border-stone-400'}`}
                    >
                      💳 Crédito
                    </button>
                    <button
                      type="button"
                      onClick={() => { handleChange({ target: { name: 'cardType', value: 'DEBIT' } }); handleChange({ target: { name: 'installments', value: '1' } }); }}
                      className={`flex-1 p-3 text-xs font-black uppercase tracking-widest border transition-colors ${formData.cardType === 'DEBIT' ? 'border-black bg-black text-white' : 'border-stone-200 text-stone-400 hover:border-stone-400'}`}
                    >
                      🏦 Débito
                    </button>
                  </div>
                  <div>
                    <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleCardNumberChange} placeholder="Número de Tarjeta (Ej: 4500 1234 5678 9000)" maxLength={19} autoComplete="cc-number" className={`w-full border p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest ${getBorderColor(formData.cardNumber, 15)}`} />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input type="text" name="cardExp" value={formData.cardExp} onChange={handleCardExpChange} placeholder="Vencimiento (MM/AA)" maxLength={5} autoComplete="cc-exp" className={`w-full border p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest text-center ${getBorderColor(formData.cardExp, 5)}`} />
                    </div>
                    <div className="flex-1">
                      <input type="password" name="cardCvc" value={formData.cardCvc} onChange={handleChange} placeholder="CVC (Ej: 123)" maxLength={4} autoComplete="cc-csc" className={`w-full border p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest text-center ${getBorderColor(formData.cardCvc, 3)}`} />
                    </div>
                  </div>
                  <div>
                    <input type="text" name="cardName" value={formData.cardName} onChange={handleChange} placeholder="Titular (Como figura en la tarjeta)" autoComplete="cc-name" className={`w-full border p-3 text-sm focus:outline-none transition-colors uppercase ${getBorderColor(formData.cardName, 4)}`} />
                  </div>
                  <div>
                    {formData.cardType === 'DEBIT' ? (
                      <div className="w-full border border-stone-200 p-3 text-sm bg-stone-50 text-stone-500">
                        1 pago (las tarjetas de débito no permiten cuotas)
                      </div>
                    ) : (
                      <select name="installments" value={formData.installments || "1"} onChange={handleChange} className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors bg-white">
                        <option value="1">1 pago sin interés</option>
                        <option value="3">3 Cuotas Fijas</option>
                        <option value="6">6 Cuotas Fijas (Cuota Simple)</option>
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>
          </label>
          
          <label className={`flex items-start gap-3 border p-4 cursor-pointer transition-colors ${formData.paymentMethod === 'TRANSFER' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="TRANSFER" checked={formData.paymentMethod === 'TRANSFER'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">Transferencia Bancaria</p>
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1">{webSettings?.web_promo_cash_discount || 15}% OFF</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Recibirás los datos bancarios al confirmar el pedido. El descuento se aplica sobre el total.</p>
            </div>
          </label>
        </div>
      )}

      <button 
        type="submit" 
        disabled={isProcessing || (!isWholesale && formData.paymentMethod === 'PAYWAY' && paywayLoaded === false)}
        className="relative w-full bg-black text-white font-bold uppercase tracking-widest text-[11px] py-5 flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors disabled:bg-stone-800 disabled:opacity-80 overflow-hidden"
      >
        {isProcessing ? (
          <>
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando pedido...
            </span>
          </>
        ) : isWholesale ? (
          <>
            Confirmar Pedido Mayorista <ShieldCheck className="w-4 h-4" />
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
      
      <div className="flex items-center justify-center gap-2 text-[9px] text-stone-400 uppercase tracking-widest text-center mt-3 border-t border-stone-100 pt-3">
        <ShieldCheck className="w-3 h-3" /> Transacción encriptada de 256-bits
      </div>
    </section>
  );
}
