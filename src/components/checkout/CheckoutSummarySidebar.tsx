import React from "react";

export function CheckoutSummarySidebar({ items, getCartTotal, formData }: { items: any[], getCartTotal: any, formData: any }) {
  return (
    <div className="lg:col-span-5 bg-[#fafafa] p-8 lg:p-10 border border-stone-200 sticky top-32">
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-4 mb-6">Resumen de Compra</h2>
      
      <div className="flex flex-col gap-6 mb-6 overflow-y-auto max-h-[40vh] pr-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="w-16 h-16 bg-white border border-stone-100 flex items-center justify-center overflow-hidden shrink-0 relative p-2">
              <img src={item.image || undefined} alt={item.model} className="w-full h-full object-contain mix-blend-multiply" />
              <div className="absolute -top-2 -right-2 bg-stone-200 text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {item.quantity}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500 mb-0.5">{item.brand}</p>
              <p className="text-sm font-medium leading-tight mb-1">{item.model}</p>
              {item.lensConfig?.lensType && item.lensConfig.lensType !== "NONE" && (
                 <p className="text-[10px] text-stone-400">Cristales: {item.lensConfig.lensType} {item.lensConfig.treatment}</p>
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
        
        {formData.paymentMethod === 'TRANSFER' && (
          <div className="flex justify-between text-sm text-green-600 font-medium animate-in fade-in">
            <span>Descuento (15% OFF Transferencia)</span>
            <span>-${(getCartTotal() * 0.15).toLocaleString("es-AR")}</span>
          </div>
        )}

        <div className="flex justify-between items-end border-t border-stone-200 pt-4 mt-2">
          <span className="text-[11px] font-black uppercase tracking-widest">Total</span>
          <div className="text-right">
            <span className="text-xs text-stone-400 block mb-1">ARS</span>
            <span className="text-2xl font-light transition-all">
              ${(formData.paymentMethod === 'TRANSFER' ? getCartTotal() * 0.85 : getCartTotal()).toLocaleString("es-AR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
