import React from "react";
import Image from "next/image";
import { CreditCard, BadgePercent, Truck } from "lucide-react";

export function CheckoutSummarySidebar({ items, getCartTotal, formData, webSettings, isWholesale }: { items: any[], getCartTotal: any, formData: any, webSettings?: { web_promo_cash_discount: number, web_promo_installments: string }, isWholesale?: boolean }) {
  const discountRate = (webSettings?.web_promo_cash_discount || 15) / 100;

  return (
    <div className="lg:col-span-5 bg-[#fafafa] p-8 lg:p-10 border border-stone-200 sticky top-32">
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-4 mb-6">Resumen de Compra</h2>

      {!isWholesale && (
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center gap-3 bg-white border border-stone-200 px-4 py-3">
            <CreditCard className="w-4 h-4 text-stone-700 shrink-0" />
            <p className="text-xs font-semibold flex-1 capitalize">{webSettings?.web_promo_installments || "6 cuotas sin interés"}</p>
            <span className="text-[9px] font-black uppercase tracking-widest bg-stone-900 text-white px-2 py-1">Con tarjeta</span>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50/60 border border-emerald-200 px-4 py-3">
            <BadgePercent className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-semibold flex-1 text-emerald-900">{Math.round(discountRate * 100)}% OFF en efectivo o transferencia</p>
            <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white px-2 py-1">Ahorrás ${(getCartTotal() * discountRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center gap-3 bg-white border border-stone-200 px-4 py-3">
            <Truck className="w-4 h-4 text-stone-700 shrink-0" />
            <p className="text-xs font-semibold flex-1">Envío gratis a todo el país</p>
            <span className="text-[9px] font-black uppercase tracking-widest border border-stone-900 px-2 py-1">Sin cargo</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 mb-6 overflow-y-auto max-h-[40vh] pr-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="w-16 h-16 bg-white border border-stone-100 flex items-center justify-center overflow-hidden shrink-0 relative p-2">
              <Image unoptimized src={item.image || '/images/og-image.jpg'} alt={item.model || 'Producto'} fill className="w-full h-full object-contain mix-blend-multiply p-2" />
              <div className="absolute -top-2 -right-2 bg-stone-200 text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
                {item.quantity}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-0.5">{item.brand}</p>
              <p className="text-sm font-medium leading-tight mb-1">{item.model}</p>
              {item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color) && (
                <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-stone-400">
                  <p>
                    Cristales: {item.lensConfig.lensType === "NONE" ? "Sin Aumento" : item.lensConfig.lensType}
                    {item.lensConfig.treatment && ` + ${item.lensConfig.treatment.replace(/_/g, ' ')}`}
                  </p>
                  {item.lensConfig.color && (
                    <p>Tinte: {item.lensConfig.color}</p>
                  )}
                  {item.lensConfig.prescriptionFile && (
                    <p className="text-green-600 font-medium">✓ Receta: {item.lensConfig.prescriptionFile}</p>
                  )}
                </div>
              )}
              <p className="text-sm font-bold mt-1">${(item.price * item.quantity).toLocaleString("es-AR")}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200 pt-6 flex flex-col gap-3">
        <div className="flex justify-between text-sm text-stone-500">
          <span>Subtotal</span>
          <span>${getCartTotal().toLocaleString("es-AR")}</span>
        </div>
        <div className="flex justify-between text-sm text-stone-500">
          <span>Envío</span>
          <span className="text-black font-bold uppercase tracking-widest text-[10px] mt-1">Gratis</span>
        </div>
        
        {isWholesale && (
          <div className="flex justify-between text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50/50 p-2 rounded border border-blue-100/80 my-1 animate-in fade-in">
            <span>Tarifa Mayorista Activa</span>
            <span>Precio Neto</span>
          </div>
        )}

        {formData.paymentMethod === 'TRANSFER' && (
          <div className="flex justify-between text-sm text-green-600 font-medium animate-in fade-in">
            <span>Descuento ({Math.round(discountRate * 100)}% OFF Transferencia)</span>
            <span>-${(getCartTotal() * discountRate).toLocaleString("es-AR")}</span>
          </div>
        )}

        <div className="flex justify-between items-end border-t border-stone-200 pt-4 mt-2">
          <span className="text-[11px] font-black uppercase tracking-widest">Total</span>
          <div className="text-right">
            <span className="text-xs text-stone-400 block mb-1">ARS</span>
            <span className="text-2xl font-light transition-all">
              ${(formData.paymentMethod === 'TRANSFER' ? getCartTotal() * (1 - discountRate) : getCartTotal()).toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
