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
          {/* El DNI solo es obligatorio pagando con tarjeta: Payway lo exige para
              tokenizar (card_holder_doc_number). Para transferencia y mayorista
              no hace falta, y pedirlo igual es un campo más que frena a alguien
              que ya decidió comprar. Si lo completan, se guarda igual. */}
          <input
            type="text"
            name="dni"
            value={formData.dni}
            required={formData.paymentMethod === 'PAYWAY'}
            pattern="[0-9]{7,11}"
            title="Ingresá un DNI o CUIL válido (7 a 11 números sin puntos ni guiones)"
            placeholder={formData.paymentMethod === 'PAYWAY' ? "DNI / CUIL (Ej: 35123456)" : "DNI / CUIL (opcional)"}
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
            pattern="^\+?[0-9]{9,15}$"
            title="Ingresá un teléfono válido, incluyendo código de área (ej: +543511234567 o 3511234567)"
            placeholder="WhatsApp (Ej: +543511234567)" 
            autoComplete="tel"
            className="w-full border border-stone-200 p-3 text-sm focus:border-black focus:focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange}
          />
        </div>
        <div className="col-span-full">
          {/* Opcional a propósito: es el único dato de esta sección que no hace
              falta para cobrar, y un campo obligatorio más frena a alguien que
              ya decidió comprar. Se pide igual porque casi ninguna ficha la
              tiene, y sin ella pasan dos cosas: el saludo de cumpleaños es
              imposible, y toda venta con cristales se traba en el gate de
              fábrica —que la exige— hasta que alguien la carga a mano. */}
          <label
            htmlFor="checkout-birthdate"
            className="block text-[11px] uppercase tracking-widest text-stone-500 mb-1"
          >
            Fecha de nacimiento <span className="normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            id="checkout-birthdate"
            type="date"
            name="birthDate"
            value={formData.birthDate || ""}
            max={new Date().toISOString().slice(0, 10)}
            autoComplete="bday"
            className="w-full border border-stone-200 p-3 text-sm text-stone-700 focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
            onChange={handleChange}
          />
          {/* No promete un beneficio de cumpleaños: ese flujo está DIFERIDO
              hasta juntar ≥200 fichas con fecha (hoy son 2 de 1096), o sea meses.
              Prometerlo ahora es quedar mal con cada persona que lo lea y no
              reciba nada. Cuando el flujo exista, se actualiza este texto. */}
          <p className="mt-1 text-[11px] leading-snug text-stone-500">
            Nos sirve para saludarte, y si tu pedido lleva cristales nos evita pedírtela después.
          </p>
        </div>
      </div>
    </section>
  );
}
