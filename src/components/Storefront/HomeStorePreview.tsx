import { getWebSettings } from '@/lib/web-settings';
import { MapPin, Clock, Phone, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import Image from "next/image";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { BUSINESS_INFO } from "@/lib/business-info";

/**
 * Los dos renglones de horario que muestra esta sección, derivados de
 * `BUSINESS_INFO.openingHoursSpecification` — la misma fuente que usan el
 * schema.org, el bot y los mensajes al cliente. Se arman acá y no se escriben
 * a mano justamente porque la versión escrita a mano quedó vieja.
 */
const franja = (dia: string) => {
  const spec = BUSINESS_INFO.openingHoursSpecification.find(o =>
    (o.dayOfWeek as readonly string[]).includes(dia));
  return spec ? `${spec.opens} - ${spec.closes} hs` : '';
};
const HORARIO_SEMANA = franja('Monday');
const HORARIO_SABADO = franja('Saturday');

export async function HomeStorePreview() {
  const settings = await getWebSettings();

  const addressLine = settings.web_store_address || "José Luis de Tejeda 4380";
  const localityLine = settings.web_store_locality || "Cerro de las Rosas, Córdoba";
  const mapsUrl = settings.web_store_maps_url || BUSINESS_INFO.mapsUrl;
  const phone = settings.web_store_phone || BUSINESS_INFO.phone;
  const whatsappPhoneId = settings.web_store_whatsapp_id || WHATSAPP_PHONE;

  // El texto secundario de esta sección va en `stone-300`, no en `stone-400/500`.
  // No es capricho estético: el fondo es `bg-stone-950` LITERAL, oscuro siempre,
  // sin importar el theme. Y `globals.css` corre los tokens `stone-300/400` un
  // escalón hacia el oscuro en `:root` para que se lean sobre fondo CLARO — así
  // que acá esos tokens hacen justo lo contrario, y `stone-400` y `stone-500`
  // terminan en el mismo hex (#78716c), a 4,1:1 contra el fondo. Debajo del piso
  // de 4,5:1. Aclarar el token global no es la salida: rompería el fondo claro,
  // que es para lo que se corrió. La sección oscura elige su propio tono.
  return (
    <section className="relative w-full bg-stone-950 pt-12 lg:pt-32 pb-10 lg:pb-20 overflow-hidden border-t border-stone-900">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#b08f4c]/10 rounded-full blur-[150px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#b08f4c]/5 rounded-full blur-[120px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Info Column (Left 5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6 lg:space-y-10">
            <div className="space-y-4 lg:space-y-6">
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
                {/* A-30 (auditoría 2/9/26): acá decía "Si no te animaste a
                    comprar en la web, ¡te esperamos en nuestro local!". Era la
                    única frase del sitio que nombraba la fricción de comprar
                    online y, en vez de resolverla, la volvía oficial: le daba
                    permiso a la persona para no comprar. Con 701 reseñas 5,0,
                    envío gratis y 30 días de garantía de adaptación no hace
                    falta pedir disculpas — el showroom es una opción más, no
                    la salida para el que no se anima. */}
                <p className="text-[#e6d0a3] text-lg font-medium leading-relaxed max-w-md">
                  Probátelos 30 días: si no te adaptás, te los cambiamos.
                </p>
                <p className="text-stone-300 text-base md:text-lg font-light leading-relaxed max-w-md">
                  Vení a conocer nuestro espacio en Córdoba Capital. Te brindamos asesoramiento estético (visagismo) y técnico especializado en un ambiente diseñado para tu comodidad.
                </p>
              </div>
            </div>

            {/* F3-05: esta sección medía 1.692 px —una dirección y dos horarios en
                más de dos pantallas— y el plan le pone tope de 750. Los tres
                bloques se apilaban en una sola columna con íconos de 56 px. En
                celular pasan a dos columnas y los íconos se achican; de lg para
                arriba queda como estaba, que ahí el alto no molesta. */}
            {/* Una sola columna en celular. Con dos, la dirección y el teléfono
                ocupaban media pantalla mientras el horario cruzaba las dos, así
                que quedaba un hueco a la derecha y los datos se partían mal:
                "José Luis de / Tejeda 4380", "+54 9 351 868- / 5644". Un número
                de teléfono cortado al medio no se puede leer ni copiar. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:space-y-8 pt-2 lg:pt-4">
              {/* Address */}
              <div className="flex gap-3 lg:gap-5 group cursor-default">
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <MapPin className="w-5 h-5 lg:w-6 lg:h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Dirección</p>
                  <p className="text-base font-medium text-stone-200">{addressLine}</p>
                  <p className="text-sm text-stone-300">{localityLine}</p>
                </div>
              </div>

              {/* Hours */}
              <div className="col-span-2 lg:col-span-1 flex gap-3 lg:gap-5 group cursor-default">
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5 w-full">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300 mb-2">Horarios de Atención</p>
                  {/* Los horarios salen de BUSINESS_INFO, no escritos a mano.
                      Acá decían "08:00 - 20:00" cuando el local abre 9:00: el
                      barrido del 1/9/26 no los agarró porque usan otro formato
                      (cero adelante y guion) que no matcheaba "8 a 20" ni
                      "8:00 a 20:00". Es exactamente el bug que el comentario de
                      `hoursWhatsAppBlock` advierte: una copia a mano que queda
                      vieja y nadie encuentra. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    <div>
                      <p className="text-sm font-medium text-stone-200">Lunes a Viernes</p>
                      <p className="text-sm text-stone-300">{HORARIO_SEMANA}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-200">Sábados</p>
                      <p className="text-sm text-stone-300">{HORARIO_SABADO}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="flex gap-3 lg:gap-5 group cursor-default">
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 group-hover:border-[#b08f4c]/50 group-hover:bg-[#b08f4c]/10 transition-all duration-500 shadow-lg">
                  <Phone className="w-5 h-5 lg:w-6 lg:h-6 text-[#b08f4c] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-1 pt-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">Contacto directo</p>
                  <p className="text-base font-medium text-stone-200">{phone}</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-5 sm:pt-8">
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
          {/* La foto y el mapa, uno al lado del otro en celular en vez de apilados.
              Apilados dentro de un contenedor de 500 px cada uno quedaba en ~240:
              ni la fachada ni el mapa se leían, y costaban media pantalla de scroll.
              Lado a lado en 260 px de alto los dos siguen siendo reconocibles y la
              sección baja 240 px. De `md` para arriba no cambia nada. */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-3 md:gap-6 h-[260px] md:h-[500px] lg:h-[700px] w-full relative z-10 mt-6 lg:mt-0">
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
              
              <div className="absolute bottom-0 left-0 right-0 p-3 md:p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
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
