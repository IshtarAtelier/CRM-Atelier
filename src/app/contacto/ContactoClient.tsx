"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function ContactoClient({ 
  whatsappPhoneId, 
  phone, 
  locality 
}: { 
  whatsappPhoneId: string; 
  phone: string; 
  locality: string 
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/web/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsSuccess(true);
        setFormData({
          name: "",
          email: "",
          phone: "",
          subject: "",
          message: ""
        });
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Hubo un error al enviar el mensaje. Intentá de nuevo.");
      }
    } catch (err) {
      setErrorMessage("Error de conexión. Por favor intentá por WhatsApp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pt-32 pb-24 px-5 max-w-[1000px] mx-auto flex flex-col md:flex-row gap-16 min-h-[70vh]">
      {/* Info lateral */}
      <div className="flex-1">
        <h1 className="font-serif text-4xl mb-4">
          Contacto
        </h1>
        <p className="text-stone-600 leading-relaxed mb-10">
          Estamos para asesorarte. Escribinos para coordinar un turno de atención personalizada o para resolver dudas sobre nuestros productos o presupuestos.
        </p>

        <div className="space-y-8">
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3">Contacto Directo</p>
            <div className="flex flex-col gap-3">
              <a 
                href={`tel:${whatsappPhoneId.replace(/\D/g, '')}`} 
                className="flex items-center gap-3 text-lg font-medium hover:text-stone-600 transition-colors w-max"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Llamar al {phone}
              </a>
              <a 
                href={`https://wa.me/${whatsappPhoneId}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-lg font-medium hover:text-emerald-600 transition-colors w-max"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Mensaje de WhatsApp
              </a>
            </div>
          </div>
          
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3">Instagram</p>
            <a href="https://instagram.com/atelieroptica_" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-lg font-medium hover:text-stone-600 transition-colors w-max">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth={2}></rect>
                <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" strokeWidth={2}></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth={2}></line>
              </svg>
              @atelieroptica_
            </a>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-3">Ubicación</p>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-1 flex-shrink-0 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-lg font-medium">{locality}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex-1 bg-stone-50 p-8 rounded-2xl border border-stone-100 relative overflow-hidden transition-all duration-500">
        {isSuccess ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 animate-in fade-in zoom-in-95 duration-500">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
            <h2 className="text-xl font-bold mb-3 uppercase tracking-wider">¡Mensaje Enviado!</h2>
            <p className="text-stone-500 text-sm leading-relaxed mb-6">
              Recibimos tu consulta con éxito. Nos pondremos en contacto contigo por correo electrónico o WhatsApp a la brevedad.
            </p>
            <button
              onClick={() => setIsSuccess(false)}
              className="px-6 py-2.5 bg-black text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-stone-800 transition-colors"
            >
              Enviar otro mensaje
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-medium mb-6">Dejanos tu mensaje</h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Nombre completo</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                  placeholder="Ej: María Pérez" 
                  required 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Email</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                    placeholder="maria@ejemplo.com" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Teléfono / WhatsApp</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                    placeholder="Ej: 3511234567" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Asunto</label>
                <input 
                  type="text" 
                  name="subject" 
                  value={formData.subject} 
                  onChange={handleChange} 
                  className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black" 
                  placeholder="Ej: Consulta de presupuesto, turno, etc." 
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">Tu consulta</label>
                <textarea 
                  name="message" 
                  value={formData.message} 
                  onChange={handleChange} 
                  className="w-full border border-stone-200 bg-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black min-h-[120px]" 
                  placeholder="¿En qué te podemos ayudar?" 
                  required
                />
              </div>

              {errorMessage && (
                <div className="text-red-500 text-xs font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                  {errorMessage}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-black text-white rounded-lg py-4 text-[11px] font-bold tracking-widest uppercase hover:bg-stone-800 transition-colors disabled:bg-stone-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Enviando..." : "Enviar Mensaje"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
