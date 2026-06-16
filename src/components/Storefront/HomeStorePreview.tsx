import { getWebSettings } from '@/lib/web-settings';
import { MapPin, Clock, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import Image from "next/image";

export async function HomeStorePreview() {
  const settings = await getWebSettings();

  const addressLine = settings.web_store_address;
  const localityLine = settings.web_store_locality;
  const mapsUrl = settings.web_store_maps_url;
  const phone = settings.web_store_phone;
  const whatsappPhoneId = settings.web_store_whatsapp_id;

  return (
    <section className="w-full bg-white py-24 border-t border-[#e8e2db]/35">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Info Column (Left 5 cols on lg) */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#b08f4c] mb-3">Presencia Local</p>
              <h2 
                className=" font-serif"
              >
                Visitá nuestro local en Cerro de las Rosas
              </h2>
              <p className="text-stone-500 text-sm font-light leading-relaxed">
                Vení a conocer nuestro showroom en Córdoba Capital. Te brindamos asesoramiento estético (visagismo) y técnico especializado en un espacio cómodo y relajado.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-150 flex items-center justify-center shrink-0 rounded-full bg-[#faf8f5]">
                  <MapPin className="w-4 h-4 text-[#b08f4c]" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Dirección</p>
                  <p className="text-sm font-semibold text-stone-800">{addressLine}</p>
                  <p className="text-xs text-stone-500">{localityLine}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-150 flex items-center justify-center shrink-0 rounded-full bg-[#faf8f5]">
                  <Clock className="w-4 h-4 text-[#b08f4c]" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Horarios de Atención</p>
                  <p className="text-sm font-semibold text-stone-850">Lunes a Viernes</p>
                  <p className="text-xs text-stone-500 mb-1">09:00 a 13:30 hs y 16:00 a 19:30 hs</p>
                  <p className="text-sm font-semibold text-stone-850">Sábados</p>
                  <p className="text-xs text-stone-500">10:00 a 14:00 hs</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-150 flex items-center justify-center shrink-0 rounded-full bg-[#faf8f5]">
                  <Phone className="w-4 h-4 text-[#b08f4c]" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Contacto directo</p>
                  <p className="text-sm font-semibold text-stone-800">{phone}</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent("Hola Atelier, vi la dirección en su web y me gustaría hacer una consulta.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 justify-center px-6 py-3.5 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors rounded-full shadow-md"
              >
                <WhatsAppIcon className="w-4 h-4" /> Chatear con Asesores
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 justify-center px-6 py-3.5 border border-stone-200 text-stone-700 text-[10px] font-black uppercase tracking-widest hover:border-black hover:text-black transition-colors rounded-full"
              >
                <MapPin className="w-4 h-4" /> Cómo llegar
              </a>
            </div>
          </div>

          {/* Map & Photos Column (Right 7 cols on lg) */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 h-full w-full">
            {/* Store Photo */}
            <div className="w-full h-[300px] md:h-[420px] overflow-hidden rounded-3xl border border-[#e8e2db]/40 shadow-sm relative group">
              <Image
                src="/images/blog/fachada-local.jpg"
                alt="Fachada Atelier Óptica"
                fill
                sizes="(max-width: 1024px) 100vw, 35vw"
                className="object-cover object-left-top group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/25 flex items-end p-6">
                <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
                  Showroom Cerro de las Rosas
                </span>
              </div>
            </div>

            {/* Google Map iframe */}
            <div className="w-full h-[300px] md:h-[420px] overflow-hidden rounded-3xl border border-[#e8e2db]/40 shadow-sm relative">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3406.126442657476!2d-64.2400508!3d-31.3831!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x943299c0da27ea09%3A0xcdd93bb53ab437c5!2sAtelier%20Optica!5e0!3m2!1sen!2sar!4v1716162356789!5m2!1sen!2sar"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "grayscale(80%) contrast(110%)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Atelier Óptica - Cerro de las Rosas Córdoba"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
