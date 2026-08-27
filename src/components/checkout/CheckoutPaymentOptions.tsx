import React from "react";
import { ShieldCheck } from "lucide-react";
import { PricingService } from "@/services/PricingService";

export function CheckoutPaymentOptions({ formData, handleChange, isProcessing, webSettings, paywayLoaded, isWholesale, payableTotal, mercadoPagoEnabled, paywayEnabled = true }: { formData: any, handleChange: any, isProcessing: boolean, webSettings?: { web_promo_cash_discount: number, web_promo_installments: string }, paywayLoaded?: boolean, isWholesale?: boolean, payableTotal?: number, mercadoPagoEnabled?: boolean, paywayEnabled?: boolean }) {
  // El monto en el botón mata la última duda ("¿cuánto termino pagando?") justo
  // en el clic que cierra la venta. Se calcula igual que el resumen de la derecha.
  const montoFmt = payableTotal && payableTotal > 0
    ? `$${Math.round(payableTotal).toLocaleString("es-AR")}`
    : null;
  // Cuántas cuotas eligió el visitante en el select, NO las del texto
  // promocional. Antes se sacaba de `web_promo_installments` ("6 cuotas sin
  // interés"), así que quien elegía 1 pago leía "Pagar $X en 6 cuotas" justo en
  // el botón que cierra la compra: el peor lugar para un número que no es.
  const cuotasElegidas = Math.max(1, Number(formData.installments) || 1);

  // Plan 12 pagos MP: números resueltos por PricingService (regla del proyecto:
  // cálculo de plata SOLO ahí) — una sola vez, para radios y botón.
  const planMp12 = payableTotal && payableTotal > 0 ? PricingService.cuotasMpLargas(payableTotal) : null;

  /** " · 6 x $107.708" para la opción de N cuotas; vacío si no hay total aún. */
  const porCuota = (n: number) =>
    payableTotal && payableTotal > 0
      ? ` · ${n} x $${Math.round(payableTotal / n).toLocaleString("es-AR")}`
      : "";

  // Con más de una cuota lo que resuelve la duda es el valor de CADA cuota
  // ("6 x $107.708"), no el total: es la cifra que la persona compara contra su
  // presupuesto mensual.
  const etiquetaPago = (() => {
    if (!montoFmt || !payableTotal) return null;
    if (cuotasElegidas <= 1) return `Pagar ${montoFmt}`;
    const valorCuotaElegida = `$${Math.round(payableTotal / cuotasElegidas).toLocaleString("es-AR")}`;
    return `Pagar ${cuotasElegidas} x ${valorCuotaElegida}`;
  })();
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
          <label className={`flex items-start gap-3 border p-4 rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === 'TRANSFER_MAYORISTA' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="TRANSFER_MAYORISTA" checked={formData.paymentMethod === 'TRANSFER_MAYORISTA'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <p className="text-sm font-bold">Transferencia Bancaria</p>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Recibirás los datos bancarios al confirmar el pedido. Pago en su totalidad por transferencia (sin cuotas).</p>
            </div>
          </label>
          
          <label className={`flex items-start gap-3 border p-4 rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === 'ACORDAR_MAYORISTA' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="ACORDAR_MAYORISTA" checked={formData.paymentMethod === 'ACORDAR_MAYORISTA'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <p className="text-sm font-bold">A convenir</p>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Pago en dos entregas a acordar con el vendedor.</p>
            </div>
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-10">
          {/* Mercado Pago: pasarela de respaldo. Solo aparece con el interruptor
              prendido (MP_ENABLED), que es lo que se activa el día que la
              pasarela principal falla. El cobro ocurre en mercadopago.com: por
              eso acá no hay campos de tarjeta y el aviso de que se sale del
              sitio va explícito — una redirección inesperada en el paso del
              pago se lee como algo raro y frena la compra.
              Va primera en la lista mientras Payway está caído: es la única vía
              de tarjeta disponible. Colapsada igual que Transferencia — el
              detalle completo solo se despliega si la persona la elige. */}
          {mercadoPagoEnabled && (
            <label className={`flex items-start gap-3 border p-4 rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === 'MERCADO_PAGO' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
              <input type="radio" name="paymentMethod" value="MERCADO_PAGO" checked={formData.paymentMethod === 'MERCADO_PAGO'} onChange={handleChange} className="accent-black mt-1" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1 gap-2 flex-wrap">
                  <p className="text-sm font-bold">Mercado Pago</p>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-[#009EE3] text-white px-2 py-1 rounded">Tarjeta, dinero en cuenta o efectivo</span>
                </div>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Te llevamos al sitio de Mercado Pago para completar el pago y volvés acá al terminar.
                </p>

                {formData.paymentMethod === 'MERCADO_PAGO' && (
                  <>
                    {/* Plan de cuotas SIEMPRE a la vista (pedido de Ishtar: el
                        desplegable escondía las opciones y "el valor solo no
                        vende"). Dos tarjetas con el monto de CADA cuota; el
                        precio final lo fija el SERVIDOR, esto solo elige plan. */}
                    <div className="mt-3 flex flex-col gap-2">
                      <label className={`flex items-center justify-between gap-3 border-2 p-3 rounded-lg cursor-pointer transition-colors ${(formData.mpCuotas || 'hasta_6') === 'hasta_6' ? 'border-black bg-white' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                        <span className="flex items-center gap-2.5">
                          <input type="radio" name="mpCuotas" value="hasta_6" checked={(formData.mpCuotas || 'hasta_6') === 'hasta_6'} onChange={handleChange} className="accent-black" />
                          <span>
                            <span className="text-[13px] font-bold block">Hasta 6 cuotas sin interés</span>
                            {payableTotal && payableTotal > 0 && (
                              <span className="text-[11px] text-stone-500 block">6 x ${Math.round(payableTotal / 6).toLocaleString('es-AR')} · total ${Math.round(payableTotal).toLocaleString('es-AR')}</span>
                            )}
                          </span>
                        </span>
                      </label>
                      <label className={`flex items-center justify-between gap-3 border-2 p-3 rounded-lg cursor-pointer transition-colors ${formData.mpCuotas === '12' ? 'border-black bg-white' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                        <span className="flex items-center gap-2.5">
                          <input type="radio" name="mpCuotas" value="12" checked={formData.mpCuotas === '12'} onChange={handleChange} className="accent-black" />
                          <span>
                            <span className="text-[13px] font-bold block">Hasta 12 pagos</span>
                            {planMp12 && (
                              <span className="text-[11px] text-stone-500 block">12 x ${planMp12.installment12.toLocaleString('es-AR')} · total ${planMp12.totalFinanced.toLocaleString('es-AR')}</span>
                            )}
                          </span>
                        </span>
                      </label>
                    </div>
                    <div className="mt-3 p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-start gap-3 select-none">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-900 block">
                          Tus datos no pasan por nuestro sitio
                        </span>
                        <span className="text-[10px] text-stone-500 block leading-relaxed">
                          La tarjeta se carga directamente en <strong>Mercado Pago</strong>. Nosotros nunca vemos ni guardamos esos datos. Podés pagar con tarjeta, saldo de Mercado Pago o efectivo por Pago Fácil y Rapipago.
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </label>
          )}

          {/* Payway: oculto mientras Mercado Pago sea la principal. Dos cajas de
              "tarjeta" casi idénticas confundían al comprador. El interruptor
              vive en el servidor (lib/checkout/gateways.ts) y garantiza que si
              Mercado Pago se apaga, esta opción vuelve sola. */}
          {paywayEnabled && (
          <label className={`flex items-start gap-3 border p-4 rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === 'PAYWAY' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="PAYWAY" checked={formData.paymentMethod === 'PAYWAY'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1 gap-2 flex-wrap">
                <p className="text-sm font-bold">Tarjeta de Crédito / Débito</p>
                <span className="text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-1 rounded">{webSettings?.web_promo_installments || "6 cuotas sin interés"}</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">Procesado de forma segura por Payway. {webSettings?.web_promo_installments ? `Promo: ${webSettings.web_promo_installments}` : "Hasta 6 cuotas sin interés"} con tarjetas bancarias.</p>

              {formData.paymentMethod === 'PAYWAY' && (
                <>
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

                  <div role="button" tabIndex={0} className="mt-6 flex flex-col gap-4 p-5 border border-stone-100 rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <input type="text" name="cardNumber" value={formData.cardNumber} onChange={handleCardNumberChange} placeholder="Número de Tarjeta (Ej: 4500 1234 5678 9000)" maxLength={19} autoComplete="cc-number" className={`w-full border rounded-lg p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest ${getBorderColor(formData.cardNumber, 15)}`} />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input type="text" name="cardExp" value={formData.cardExp} onChange={handleCardExpChange} placeholder="Vencimiento (MM/AA)" maxLength={5} autoComplete="cc-exp" className={`w-full border rounded-lg p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest text-center ${getBorderColor(formData.cardExp, 5)}`} />
                      </div>
                      <div className="flex-1">
                        <input type="password" name="cardCvc" value={formData.cardCvc} onChange={handleChange} placeholder="CVC (Ej: 123)" maxLength={4} autoComplete="cc-csc" className={`w-full border rounded-lg p-3 text-sm focus:outline-none transition-colors font-mono tracking-widest text-center ${getBorderColor(formData.cardCvc, 3)}`} />
                      </div>
                    </div>
                    <div>
                      <input type="text" name="cardName" value={formData.cardName} onChange={handleChange} placeholder="Titular (Como figura en la tarjeta)" autoComplete="cc-name" className={`w-full border rounded-lg p-3 text-sm focus:outline-none transition-colors uppercase ${getBorderColor(formData.cardName, 4)}`} />
                    </div>
                    <div>
                      {/* El valor de cada cuota va en la opción misma: es el número
                          con el que la persona decide, y tenerlo que calcular de
                          cabeza en el checkout es fricción pura. */}
                      <select name="installments" value={formData.installments || "1"} onChange={handleChange} className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors bg-white">
                        <option value="1">1 pago sin interés{montoFmt ? ` · ${montoFmt}` : ""}</option>
                        <option value="3">3 cuotas sin interés{porCuota(3)}</option>
                        <option value="6">6 cuotas sin interés (Cuota Simple){porCuota(6)}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </label>
          )}

          <label className={`flex items-start gap-3 border p-4 rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === 'TRANSFER' ? 'border-black bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}>
            <input type="radio" name="paymentMethod" value="TRANSFER" checked={formData.paymentMethod === 'TRANSFER'} onChange={handleChange} className="accent-black mt-1" />
            <div className="flex-1">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">Transferencia Bancaria</p>
                <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1 rounded">{webSettings?.web_promo_cash_discount || 15}% OFF</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-1">Recibirás los datos bancarios al confirmar el pedido. El descuento se aplica sobre el total.</p>
            </div>
          </label>
        </div>
      )}

      <button 
        type="submit" 
        disabled={isProcessing || (!isWholesale && formData.paymentMethod === 'PAYWAY' && paywayLoaded === false)}
        className="relative w-full bg-black text-white font-bold uppercase tracking-widest text-[11px] py-5 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:bg-stone-800 disabled:opacity-80 overflow-hidden"
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
            {etiquetaPago || "Pagar con Tarjeta"} <ShieldCheck className="w-4 h-4" />
          </>
        ) : formData.paymentMethod === 'MERCADO_PAGO' ? (
          // Dice que se sale del sitio, porque se sale del sitio. El botón que
          // promete "pagar" y en cambio redirige es el que hace abandonar.
          // Con el plan de 12 el botón muestra el TOTAL DEL PLAN (con recargo):
          // el número del botón tiene que ser el que se va a pagar, siempre.
          <>
            {payableTotal && payableTotal > 0
              ? `Continuar a Mercado Pago · $${(formData.mpCuotas === '12' && planMp12 ? planMp12.totalFinanced : Math.round(payableTotal)).toLocaleString('es-AR')}`
              : "Continuar a Mercado Pago"} <ShieldCheck className="w-4 h-4" />
          </>
        ) : (
          <>
            {montoFmt ? `Confirmar pedido · ${montoFmt} por transferencia` : "Confirmar Pedido"} <ShieldCheck className="w-4 h-4" />
          </>
        )}
      </button>
      
      <div className="flex items-center justify-center gap-2 text-[9px] text-stone-400 uppercase tracking-widest text-center mt-3 border-t border-stone-100 pt-3">
        <ShieldCheck className="w-3 h-3" /> Transacción encriptada de 256-bits
      </div>
    </section>
  );
}
