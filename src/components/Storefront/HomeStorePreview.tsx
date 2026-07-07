import { getWebSettings } from '@/lib/web-settings';
import { MapPin, Clock, Phone, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { BUSINESS_INFO } from "@/lib/business-info";

export async function HomeStorePreview() {
  const settings = await getWebSettings();

  const addressLine = settings.web_store_address || "José Luis de Tejeda 4380";
  const localityLine = settings.web_store_locality || "Cerro de las Rosas, Córdoba";
  const mapsUrl = settings.web_store_maps_url || BUSINESS_INFO.mapsUrl;
  const phone = settings.web_store_phone || BUSINESS_INFO.phone;
  const whatsappPhoneId = settings.web_store_whatsapp_id || WHATSAPP_PHONE;

  return (
    <section className="relative w-full bg-stone-950 pt-24 lg:pt-32 pb-16 lg:pb-20 overflow-hidden border-t border-stone-900">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#b08f4c]/10 rounded-full blur-[150px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#b08f4c]/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-start">
          
          {/* Info Column (Left 5 cols on lg) */}
          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#b08f4c]/10 border border-[#b08f4c]/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b08f4c] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#b08f4c]"></span>
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b08f4c]">
                  Presencia Local
                </p>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-serif text-white leading-[1.1] tracking-tight">
                Visitá nuestro <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#b08f4c] to-[#e6d0a3]">showroom</span> en Cerro de las Rosas
              </h2>
              
              <div className="space-y-3">
                <p className="text-[#e6d0a3] text-lg font-medium leading-relaxed max-w-md">
                  Si no te animaste a comprar en la web, ¡te esperamos en nuestro local!
                </p>
                <p className="text-stone-400 text-base md:text-lg font-light leading-relaxed max-w-md">
                  Vení a conocer nuestro espacio en Córdoba Capital. Te brindamos asesoramiento estético (visagismo) y técnico especializado en un ambiente diseñado para tu comodidad.
                </p>
              </div>
            </div>

            <div className="space-y-8 pt-4">
              {/* Address */}
              <div className="flex gap-5 group cursor-default">
                <div className="w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <MapPin className="w-6 h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Dirección</p>
                  <p className="text-base font-medium text-stone-200">{addressLine}</p>
                  <p className="text-sm text-stone-400">{localityLine}</p>
                </div>
              </div>

              {/* Hours */}
              <div className="flex gap-5 group cursor-default">
                <div className="w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <Clock className="w-6 h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5 w-full">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Horarios de Atención</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-stone-200">Lunes a Viernes</p>
                      <p className="text-sm text-stone-400">09:00 - 13:30 hs</p>
                      <p className="text-sm text-stone-400">16:00 - 19:30 hs</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-200">Sábados</p>
                      <p className="text-sm text-stone-400">10:00 - 14:00 hs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="flex gap-5 group cursor-default">
                <div className="w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <Phone className="w-6 h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Contacto directo</p>
                  <p className="text-base font-medium text-stone-200">{phone}</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              <a
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent("Hola Atelier, vi la dirección en su web y me gustaría hacer una consulta.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-3 justify-center px-8 py-4 bg-[#b08f4c] text-stone-950 text-[11px] font-black uppercase tracking-[0.15em] rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(176,143,76,0.4)]"
              >
                <WhatsAppIcon className="w-4 h-4" /> 
                <span>Chatear con Asesores</span>
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 justify-center px-8 py-4 bg-transparent border border-stone-700 text-stone-300 text-[11px] font-black uppercase tracking-[0.15em] hover:bg-white hover:border-white hover:text-black transition-all duration-300 rounded-full"
              >
                <MapPin className="w-4 h-4" /> 
                <span>Cómo llegar</span>
              </a>
            </div>
          </div>

          {/* Map & Photos Column (Right 7 cols on lg) */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px] lg:h-[700px] w-full relative z-10 mt-8 lg:mt-0">
            {/* Store Photo */}
            <div className="w-full h-full overflow-hidden rounded-[2rem] border border-stone-800/60 shadow-2xl relative group">
              <div className="absolute inset-0 bg-stone-900 animate-pulse" /> {/* Placeholder while loading */}
              <Image
                src="/images/blog/fachada-local.jpg"
                alt="Fachada Atelier Óptica"
                fill
                sizes="(max-width: 1024px) 100vw, 35vw"
                className="object-cover object-center group-hover:scale-110 transition-transform duration-[1.5s] ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
              
              <div className="absolute bottom-0 left-0 right-0 p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-[#b08f4c] shadow-[0_0_10px_rgba(176,143,76,0.8)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Showroom Oficial
                  </span>
                </div>
              </div>
            </div>

            {/* Google Map iframe */}
            <div className="w-full h-full overflow-hidden rounded-[2rem] border border-stone-800/60 shadow-2xl relative group bg-stone-900">
              <div className="absolute inset-0 bg-stone-900 animate-pulse" />
              <iframe
                src="https://maps.google.com/maps?width=100%25&amp;height=600&amp;hl=en&amp;q=Luis%20Jose%20De%20Tejeda%204380,%20Cerro%20de%20las%20Rosas,%20C%C3%B3rdoba+(Atelier%20%C3%93ptica)&amp;t=&amp;z=15&amp;ie=UTF8&amp;iwloc=B&amp;output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Atelier Óptica - Cerro de las Rosas Córdoba"
                className="relative z-10 group-hover:opacity-100 transition-opacity duration-500"
              />
              <div className="absolute inset-0 pointer-events-none rounded-[2rem] shadow-[inset_0_0_40px_rgba(28,25,23,0.9)] z-20" />
              
              <div className="absolute top-6 right-6 z-30 transform -translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir ubicación en Google Maps"
                  className="w-12 h-12 bg-[#b08f4c] text-stone-950 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ArrowRight className="w-5 h-5 -rotate-45" />
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
