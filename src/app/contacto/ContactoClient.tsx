"use client";

import { useState } from "react";
import { CheckCircle2, Phone, MapPin, Instagram, Sparkles, Clock, UserCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function ContactoClient({ 
  whatsappPhoneId, 
  phone, 
  address,
  locality,
  mapsUrl
}: { 
  whatsappPhoneId: string; 
  phone: string; 
  address: string;
  locality: string;
  mapsUrl: string;
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

  const WHATSAPP_TEXT = encodeURIComponent("¡Hola Atelier! Me gustaría recibir asesoramiento y presupuestar una receta.");
  const WHATSAPP_URL = `https://wa.me/${whatsappPhoneId}?text=${WHATSAPP_TEXT}`;

  return (
    <main className="pt-36 pb-24 px-5 max-w-[1100px] mx-auto min-h-[80vh] flex flex-col gap-16">
      {/* Header Premium */}
      <div className="max-w-2xl text-left md:text-center md:mx-auto">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#c8a55c] block mb-3">
          Atención Personalizada
        </span>
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4 text-stone-950">
          Contacto & Asesoramiento
        </h1>
        <p className="text-stone-500 leading-relaxed text-sm md:text-base">
          Escribinos para coordinar un turno de atención personalizada en nuestro local o para resolver cualquier duda sobre tus cristales, recetas o armazones.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 items-stretch">
        {/* Panel Izquierdo: WhatsApp Instantáneo (Canal Principal de Conversión) */}
        <div className="flex-1 bg-gradient-to-br from-stone-50 to-[#FAF9F5] p-8 md:p-10 rounded-[32px] border border-stone-200/50 shadow-sm flex flex-col justify-between relative overflow-visible">
          
          {/* Decorative radial gradient */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#c8a55c]/5 blur-3xl pointer-events-none" />

          <div>
            {/* Live Status Badge */}
            <div className="flex items-center gap-2 bg-[#c8a55c]/10 border border-[#c8a55c]/20 text-[#967634] text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full w-max mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Respuesta al instante
            </div>

            {/* Headline */}
            <h2 className="font-serif text-3xl md:text-4xl text-stone-900 tracking-tight leading-tight mb-4">
              Asesoramiento <br className="hidden md:inline" />
              <span className="text-[#c8a55c] italic font-normal">en segundos</span>
            </h2>

            {/* Description */}
            <p className="text-stone-600 leading-relaxed text-sm md:text-base mb-8">
              Tu presupuesto y asesoramiento <strong className="text-stone-800 font-semibold">sin cargo en segundos</strong> por los ópticos mejor calificados. Envíanos una foto de tu receta y te cotizamos al instante.
            </p>

            {/* Trust pillars list */}
            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3 text-stone-700 text-sm">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span>Respuesta directa e inmediata por chat</span>
              </li>
              <li className="flex items-center gap-3 text-stone-700 text-sm">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <span>Ópticos matriculados a tu disposición</span>
              </li>
              <li className="flex items-center gap-3 text-stone-700 text-sm">
                <div className="w-5 h-5 rounded-full bg-[#c8a55c]/5 text-[#c8a55c] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>Presupuesto a medida sin compromiso</span>
              </li>
            </ul>
          </div>

          {/* WhatsApp CTA Area */}
          <div className="relative w-full mt-6">
            {/* Elegant pointing arrow floating above the button */}
            <motion.div 
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="absolute -top-16 right-4 hidden md:flex flex-col items-center gap-1.5 text-[#c8a55c]"
            >
              <span className="font-serif italic text-xs tracking-wider text-stone-500">Hacé click acá para chatear</span>
              <svg className="w-10 h-10 transform rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                {/* Curved arrow pointing down-left */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 3c-1.5 2.5-4.5 6-9 6.5M8.5 6L5 9.5l4.5 1" />
              </svg>
            </motion.div>

            {/* Mobile indicator arrow (pulsing/moving pointing arrow) */}
            <motion.div 
              animate={{ x: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="md:hidden absolute -left-10 top-4.5 text-[#c8a55c] flex items-center"
            >
              <ArrowRight className="w-6 h-6" />
            </motion.div>

            <a 
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-stone-900 hover:bg-[#c8a55c] text-white rounded-2xl py-4.5 px-6 text-xs font-bold uppercase tracking-[0.2em] shadow-lg shadow-stone-900/10 hover:shadow-xl hover:shadow-[#c8a55c]/25 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 pointer-events-auto"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Iniciar Presupuesto
            </a>
          </div>

        </div>

        {/* Panel Derecho: Formulario de Contacto / Consulta tradicional */}
        <div className="flex-1 bg-white p-8 md:p-10 rounded-[32px] border border-stone-200 shadow-sm flex flex-col justify-between">
          {isSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 animate-in fade-in zoom-in-95 duration-500">
              <CheckCircle2 className="w-16 h-16 text-[#c8a55c] mb-6" />
              <h2 className="text-xl font-bold mb-3 uppercase tracking-wider text-stone-900">¡Mensaje Enviado!</h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-8">
                Recibimos tu consulta con éxito. Nos pondremos en contacto contigo por correo electrónico o WhatsApp a la brevedad.
              </p>
              <button
                onClick={() => setIsSuccess(false)}
                className="px-6 py-3 bg-stone-950 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#c8a55c] transition-colors duration-300"
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <h3 className="font-serif text-2xl text-stone-900 mb-2">Dejanos tu consulta</h3>
              <p className="text-xs text-stone-400 mb-6">
                Si preferís escribirnos un email, completá los campos a continuación y te responderemos por correo.
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a07e3c] mb-1">Nombre completo</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  className="w-full border-b border-stone-200 bg-transparent rounded-none py-2 text-sm focus:outline-none focus:border-[#c8a55c] transition-colors placeholder-stone-300 text-stone-800" 
                  placeholder="Ej: María Pérez" 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a07e3c] mb-1">Email</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="w-full border-b border-stone-200 bg-transparent rounded-none py-2 text-sm focus:outline-none focus:border-[#c8a55c] transition-colors placeholder-stone-300 text-stone-800" 
                    placeholder="maria@ejemplo.com" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a07e3c] mb-1">Teléfono / WhatsApp</label>
                  <input 
                    type="tel" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    className="w-full border-b border-stone-200 bg-transparent rounded-none py-2 text-sm focus:outline-none focus:border-[#c8a55c] transition-colors placeholder-stone-300 text-stone-800" 
                    placeholder="Ej: 3511234567" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a07e3c] mb-1">Asunto</label>
                <input 
                  type="text" 
                  name="subject" 
                  value={formData.subject} 
                  onChange={handleChange} 
                  className="w-full border-b border-stone-200 bg-transparent rounded-none py-2 text-sm focus:outline-none focus:border-[#c8a55c] transition-colors placeholder-stone-300 text-stone-800" 
                  placeholder="Ej: Consulta de presupuesto, turno, etc." 
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#a07e3c] mb-1">Tu consulta</label>
                <textarea 
                  name="message" 
                  value={formData.message} 
                  onChange={handleChange} 
                  className="w-full border-b border-stone-200 bg-transparent rounded-none py-2 text-sm focus:outline-none focus:border-[#c8a55c] transition-colors placeholder-stone-300 min-h-[100px] resize-y text-stone-800" 
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
                className="w-full bg-stone-900 text-white rounded-xl py-4 text-[10px] font-bold tracking-widest uppercase hover:bg-[#c8a55c] transition-all duration-300 disabled:bg-stone-400 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#c8a55c]/10"
              >
                {isSubmitting ? "Enviando..." : "Enviar Mensaje"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Info de contacto tradicional e Info del Local en footer-like section */}
      <div className="border-t border-stone-100 pt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-150 flex items-center justify-center flex-shrink-0 text-stone-800">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Llamanos</h4>
            <a href={`tel:${whatsappPhoneId.replace(/\D/g, '')}`} className="text-stone-800 hover:text-[#c8a55c] font-medium transition-colors">
              {phone}
            </a>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-150 flex items-center justify-center flex-shrink-0 text-stone-800">
            <Instagram className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Instagram</h4>
            <a href="https://instagram.com/atelieroptica_" target="_blank" rel="noopener noreferrer" className="text-stone-800 hover:text-[#c8a55c] font-medium transition-colors">
              @atelieroptica_
            </a>
          </div>
        </div>

        <a 
          href={mapsUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex gap-4 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-150 flex items-center justify-center flex-shrink-0 text-stone-800 group-hover:bg-[#c8a55c] group-hover:text-white group-hover:border-[#c8a55c] transition-all duration-300">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1 group-hover:text-[#c8a55c] transition-colors">Visitanos</h4>
            <p className="text-stone-800 font-medium text-sm leading-snug group-hover:underline decoration-[#c8a55c]/30 underline-offset-2">
              {address}, {locality}
            </p>
          </div>
        </a>
      </div>
    </main>
  );
}
