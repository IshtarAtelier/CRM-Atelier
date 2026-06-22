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
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">WhatsApp Directo</p>
            <a href={`https://wa.me/${whatsappPhoneId}`} className="text-lg font-medium hover:underline decoration-1 underline-offset-4">{phone}</a>
          </div>
          
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">Instagram</p>
            <a href="https://instagram.com/atelieroptica_" className="text-lg font-medium hover:underline decoration-1 underline-offset-4">@atelieroptica_</a>
          </div>

          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2">Ubicación</p>
            <p className="text-lg font-medium">{locality}</p>
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
