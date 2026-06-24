import React from "react";
import { Truck, Home, MapPin } from "lucide-react";

export function CheckoutShippingForm({ formData, handleChange, isLocalCity, hasCrystals }: { formData: any, handleChange: any, isLocalCity: boolean, hasCrystals: boolean }) {
  const selectedMethod = formData.shippingMethod;

  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">2. Envío</h2>
      
      <div className="flex flex-col gap-3 mb-6">
        {isLocalCity && (
          <label className={`flex items-start justify-between border p-4 cursor-pointer transition-all duration-300 rounded-lg ${selectedMethod === 'LOCAL' ? 'border-black bg-stone-50' : 'border-stone-200 bg-white hover:bg-stone-50/50'}`}>
            <div className="flex items-start gap-3">
              <input 
                type="radio" 
                name="shippingMethod" 
                value="LOCAL" 
                checked={selectedMethod === 'LOCAL'} 
                onChange={handleChange}
                className="accent-black mt-1" 
              />
              <div className="-mt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-black">Retiro en Local (Córdoba)</p>
                  <span className="text-[9px] font-bold text-[#1b4332] bg-green-50 px-1.5 py-0.5 rounded-sm uppercase">Gratis</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  Retirá tu pedido directamente en nuestro atelier de Cerro de las Rosas. Te avisamos por WhatsApp apenas esté listo.
                </p>
                {hasCrystals && (
                  <p className="text-[10px] font-bold text-stone-700 mt-1.5 uppercase tracking-wider">
                    Listo en 5 días hábiles
                  </p>
                )}
              </div>
            </div>
            <MapPin className={`w-5 h-5 transition-colors ${selectedMethod === 'LOCAL' ? 'text-black' : 'text-stone-400'}`} />
          </label>
        )}

        <label className={`flex items-start justify-between border p-4 cursor-pointer transition-all duration-300 rounded-lg ${selectedMethod === 'CORREO_DOMICILIO' ? 'border-black bg-stone-50' : 'border-stone-200 bg-white hover:bg-stone-50/50'}`}>
          <div className="flex items-start gap-3">
            <input 
              type="radio" 
              name="shippingMethod" 
              value="CORREO_DOMICILIO" 
              checked={selectedMethod === 'CORREO_DOMICILIO'} 
              onChange={handleChange}
              className="accent-black mt-1" 
            />
            <div className="-mt-0.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <p className="text-sm font-bold text-black">Envío a Domicilio (Correo Argentino)</p>
                <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-1 rounded shadow-sm uppercase animate-pulse w-fit">
                  ¡Solo por esta semana: Envío Sin Cargo!
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                Envío bonificado a cualquier punto del país. Llega directo a tu puerta.
              </p>
              <p className="text-[11.5px] text-stone-800 mt-2 font-medium">
                🕒 Tránsito: <strong>3 a 5 días hábiles</strong> desde que se despacha.
              </p>
              {hasCrystals && (
                <p className="text-[10.5px] text-amber-700 bg-amber-50/50 border border-amber-100 px-2.5 py-1 rounded-md mt-2 font-medium">
                  ⚙️ Laboratorio y calibrado: 5 días hábiles para el despacho
                </p>
              )}
            </div>
          </div>
          <Home className={`w-5 h-5 transition-colors ${selectedMethod === 'CORREO_DOMICILIO' ? 'text-black' : 'text-stone-400'}`} />
        </label>

        <label className={`flex items-start justify-between border p-4 cursor-pointer transition-all duration-300 rounded-lg ${selectedMethod === 'CORREO_SUCURSAL' ? 'border-black bg-stone-50' : 'border-stone-200 bg-white hover:bg-stone-50/50'}`}>
          <div className="flex items-start gap-3">
            <input 
              type="radio" 
              name="shippingMethod" 
              value="CORREO_SUCURSAL" 
              checked={selectedMethod === 'CORREO_SUCURSAL'} 
              onChange={handleChange}
              className="accent-black mt-1" 
            />
            <div className="-mt-0.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <p className="text-sm font-bold text-black">Envío a Sucursal (Correo Argentino)</p>
                <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-1 rounded shadow-sm uppercase animate-pulse w-fit">
                  ¡Solo por esta semana: Envío Sin Cargo!
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                Retirá en la sucursal oficial de Correo Argentino de tu localidad.
              </p>
              <p className="text-[11.5px] text-stone-800 mt-2 font-medium">
                🕒 Tránsito: <strong>3 a 5 días hábiles</strong> desde que se despacha.
              </p>
              {hasCrystals && (
                <p className="text-[10.5px] text-amber-700 bg-amber-50/50 border border-amber-100 px-2.5 py-1 rounded-md mt-2 font-medium">
                  ⚙️ Laboratorio y calibrado: 5 días hábiles para el despacho
                </p>
              )}
            </div>
          </div>
          <Truck className={`w-5 h-5 transition-colors ${selectedMethod === 'CORREO_SUCURSAL' ? 'text-black' : 'text-stone-400'}`} />
        </label>
      </div>

      {selectedMethod === 'CORREO_SUCURSAL' && (
        <div className="mb-6 animate-fade-in">
          <label className="block text-[11px] text-stone-500 font-bold uppercase tracking-wider mb-2">Sucursal de Correo Argentino de preferencia (Opcional)</label>
          <input 
            type="text" 
            name="shippingBranch" 
            value={formData.shippingBranch || ""}
            placeholder="Ej: Sucursal Cerro de las Rosas (Av. Rafael Núñez 4200) o dejas vacío y coordinamos por WhatsApp" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors rounded-lg bg-stone-50/30" 
            onChange={handleChange} 
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-full">
          <input 
            type="text" 
            name="address" 
            value={formData.address}
            required 
            placeholder="Dirección (Calle, Número, Depto)" 
            autoComplete="street-address"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
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
            autoComplete="address-level2"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
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
            autoComplete="address-level1"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
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
            autoComplete="postal-code"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
      </div>
    </section>
  );
}
