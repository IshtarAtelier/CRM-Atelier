import React from "react";
import { Truck } from "lucide-react";

export function CheckoutShippingForm({ formData, handleChange, isLocalCity, hasCrystals }: { formData: any, handleChange: any, isLocalCity: boolean, hasCrystals: boolean }) {
  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">2. Envío</h2>
      
      <div className="mb-4">
        <label className="flex items-center justify-between border border-black p-4 cursor-pointer bg-stone-50 transition-colors hover:bg-stone-100">
          <div className="flex items-center gap-3">
            <input type="radio" name="shippingMethod" value="FREE" checked className="accent-black" readOnly />
            <div>
              <p className="text-sm font-bold">
                {isLocalCity ? 'Envío por Cadetería Local (Gratis)' : 'Envío a Domicilio (Gratis)'}
              </p>
              <p className="text-[11px] text-stone-500 uppercase tracking-widest mt-1">
                {isLocalCity 
                  ? `Envíos dentro de Cba / Carlos Paz · ${hasCrystals ? 'Lab: 7 a 10 días hábiles' : 'Despacho en 24hs'}` 
                  : `A todo el país vía Andreani · ${hasCrystals ? 'Lab: 7 a 10 días hábiles' : 'Despacho en 24hs'}`}
              </p>
            </div>
          </div>
          <Truck className="w-5 h-5 text-stone-400" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-full">
          <input 
            type="text" 
            name="address" 
            value={formData.address}
            required 
            placeholder="Dirección (Calle, Número, Depto)" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div className="col-span-full">
          <input 
            type="text" 
            name="city" 
            value={formData.city}
            required 
            placeholder="Ciudad" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="text" 
            name="state" 
            value={formData.state}
            required 
            placeholder="Provincia" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="text" 
            name="zip" 
            value={formData.zip}
            required 
            placeholder="Código Postal" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
      </div>
    </section>
  );
}
