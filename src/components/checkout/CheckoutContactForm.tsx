import React, { useEffect, useRef } from "react";
import { telefonoValido, telefonoADigitos, MENSAJE_TELEFONO_INVALIDO, MENSAJE_TELEFONO_OK } from "@/lib/checkout/telefono";

export function CheckoutContactForm({ formData, handleChange }: { formData: any, handleChange: any }) {
  // La validez del teléfono la decide `telefonoValido` y no un `pattern`: el
  // número se escribe con espacios, guiones o paréntesis y lo que importa es
  // cuántos dígitos tiene, cosa que una regex de atributo expresa mal. Con
  // `setCustomValidity` el navegador frena el envío y muestra el mensaje igual
  // que con cualquier otro campo del form.
  const telefonoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const valido = !formData.phone || telefonoValido(formData.phone);
    telefonoRef.current?.setCustomValidity(valido ? "" : MENSAJE_TELEFONO_INVALIDO);
  }, [formData.phone]);
  // El aviso ámbar recién aparece con 3 dígitos: antes de eso no hay nada que
  // corregir, y un cartel desde la primera tecla se lee como un error propio.
  const telefonoTipeado = telefonoADigitos(formData.phone).length >= 3;
  const telefonoOk = telefonoValido(formData.phone);

  return (
    <section>
      <h2 className="text-[11px] font-black uppercase tracking-widest border-b border-stone-200 pb-2 mb-4">1. Contacto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* El WhatsApp va PRIMERO (auditoría 25/9/2026): 18 de 20 sesiones que
            abandonaron dejaron solo el email, porque el teléfono era el cuarto
            campo y no llegaban. El recupero de carritos escribe por WhatsApp,
            así que sin este dato no hay a quién escribirle. */}
        {/* Validación EN VIVO (plan 15/10/2026, 3.1): la persona ve si el número
            sirve mientras lo escribe, no cuando el navegador frena el pago. Con el
            número válido se le dice para qué lo pedimos — es el dato con el que
            el equipo la recupera si se va antes de pagar. */}
        <div className="col-span-full">
          <label htmlFor="checkout-whatsapp" className="block text-[11px] font-bold text-stone-700 mb-1.5">
            Tu WhatsApp <span className="font-medium text-stone-500">· por acá te avisamos del pedido</span>
          </label>
          <input
            ref={telefonoRef}
            id="checkout-whatsapp"
            type="tel"
            name="phone"
            value={formData.phone}
            required
            inputMode="tel"
            placeholder="WhatsApp (Ej: 351 123-4567)"
            autoComplete="tel"
            aria-invalid={telefonoTipeado && !telefonoOk ? true : undefined}
            aria-describedby="checkout-whatsapp-estado"
            className={`w-full border rounded-lg p-3 text-sm focus:ring-2 focus:outline-none transition-colors ${
              !telefonoTipeado ? "border-stone-200 focus:border-black focus:ring-amber-500"
                : telefonoOk ? "border-emerald-400 focus:border-emerald-600 focus:ring-emerald-200"
                : "border-amber-400 focus:border-amber-600 focus:ring-amber-200"
            }`}
            onChange={handleChange}
          />
          <p id="checkout-whatsapp-estado" className={`mt-1.5 text-[11px] font-medium min-h-[1rem] ${telefonoOk ? "text-emerald-700" : "text-amber-800"}`} aria-live="polite">
            {!telefonoTipeado ? "" : telefonoOk ? MENSAJE_TELEFONO_OK : MENSAJE_TELEFONO_INVALIDO}
          </p>
        </div>
        <div className="col-span-full">
          <input 
            type="email" 
            name="email" 
            value={formData.email}
            required 
            placeholder="Correo Electrónico" 
            autoComplete="email"
            className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
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
            className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
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
            className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors" 
            onChange={handleChange} 
          />
        </div>
        <div className="col-span-full">
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
            className="w-full border border-stone-200 rounded-lg p-3 text-sm focus:border-black focus:ring-2 focus:ring-amber-500 focus:outline-none transition-colors"
            onChange={handleChange}
          />
        </div>
        {/* La fecha de nacimiento se sacó del checkout el 11/8/2026: un campo
            más entre "ya decidí comprar" y el pago, a cambio de un dato que no
            hace falta para cobrar.
            Consecuencia asumida: el gate de fábrica la exige, así que toda venta
            con cristales queda esperando a que alguien la cargue a mano en la
            ficha. El backend sigue aceptando `birthDate` (payway/route.ts la
            guarda si viene), así que volver a mostrarla es reponer este bloque
            —no hay nada más que tocar. */}
      </div>
    </section>
  );
}
