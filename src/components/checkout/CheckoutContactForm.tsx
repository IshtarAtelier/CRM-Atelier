import React from "react";

export function CheckoutContactForm({ formData, handleChange }: { formData: any, handleChange: any }) {
  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">1. Contacto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="col-span-full">
          <input 
            type="email" 
            name="email" 
            value={formData.email}
            required 
            placeholder="Correo Electrónico" 
            autoComplete="email"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="text" 
            name="firstName" 
            value={formData.firstName}
            required 
            placeholder="Nombre" 
            autoComplete="given-name"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="text" 
            name="lastName" 
            value={formData.lastName}
            required 
            placeholder="Apellido" 
            autoComplete="family-name"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="text" 
            name="dni" 
            value={formData.dni}
            required 
            pattern="[0-9]{7,11}"
            title="Ingresá un DNI o CUIL válido (7 a 11 números sin puntos ni guiones)"
            placeholder="DNI / CUIL (Ej: 35123456)" 
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div>
          <input 
            type="tel" 
            name="phone" 
            value={formData.phone}
            required 
            pattern="[0-9]{10,13}"
            title="Ingresá un teléfono válido, incluyendo código de área sin el 15. Ej: 3511234567"
            placeholder="WhatsApp (Ej: 3511234567)" 
            autoComplete="tel"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
      </div>
    </section>
  );
}
