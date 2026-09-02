"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PricingService } from "@/services/PricingService";
import { textoCuotas12 } from "@/lib/promo-cuotas";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { WHATSAPP_PHONE } from "@/lib/constants";
import { trackWhatsAppClick } from "@/lib/tracking";

interface CarouselProduct {
  id: string | number;
  name: string;
  price: string;
  rawPrice?: number | null;
  img: string;
  slug: string;
  stock?: number | null;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  secondImg?: string | null;
}

interface Props {
  collections: {
    destacados: CarouselProduct[];
    clipon: CarouselProduct[];
    sol: CarouselProduct[];
    receta: CarouselProduct[];
    nuevos: CarouselProduct[];
  };
  totalCount: number;
}

type TabKey = 'destacados' | 'clipon' | 'sol' | 'receta' | 'nuevos';

export function HomeProductCarousel({ collections, totalCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('destacados');
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const products = collections[activeTab] || [];

  // A-10 y A-22 (auditoría 2/9/26). Acá vivía un "marquee híbrido": un
  // requestAnimationFrame que empujaba `scrollLeft` un píxel por frame, con
  // listeners de mouse/touch/wheel para pausarlo, y la lista de productos
  // DUPLICADA para que el loop se viera continuo.
  //
  // Dos problemas medidos, los dos en el primer contenido comercial del home:
  //   A-10 — al pasar el mouse por encima, la rueda movía el carrusel en vez
  //          de bajar la página.
  //   A-22 — quien llegaba al final veía los mismos anteojos otra vez y
  //          concluía que el catálogo son 12 modelos, no 112.
  //
  // Se va entero. Queda scroll horizontal nativo con anclaje (snap), que es lo
  // que la gente ya sabe usar, no pelea con la rueda, no duplica nada y no
  // gasta un frame por segundo de CPU. El recorrido termina en una card que
  // lleva al catálogo completo.

  // Reset scroll when tab changes
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

  if (!collections || !products) return null;

  return (
    <section className="w-full bg-white pb-12 flex flex-col items-center">
      
      {/* TABS DE FILTRO */}
      <div className="flex gap-4 px-5 mb-8 w-full max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        {[
          { key: 'destacados', label: 'Destacados' },
          { key: 'clipon', label: 'ClipOn' },
          { key: 'sol', label: 'Sol' },
          { key: 'receta', label: 'Receta' },
          { key: 'nuevos', label: 'Nuevos' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap rounded-full border cursor-pointer ${
              activeTab === tab.key 
                ? 'bg-black text-white border-black' 
                : 'bg-white text-stone-500 border-stone-200 hover:border-black hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div 
        ref={carouselRef}
        className="flex w-full overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((item, i) => {
          const isTitanium = (item.model || '').toUpperCase().includes('TG') || (item.name || '').toUpperCase().includes('TITANIUM');
          return (
            <Link 
              href={`/producto/${item.slug}`} 
              key={`${item.id}-${i}`} 
              className="group flex-shrink-0 snap-start w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-shadow duration-500 hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
            >
              {/* Contenedor de imagen — fondo blanco. Sin mix-blend ni isolate: en el
                  carrusel auto-scrolleado esa capa de composición NO se pintaba en prod
                  (cards en gris vacío). El fondo blanco funde las fotos igual de limpio. */}
              <div className="bg-white aspect-square overflow-hidden border-r border-[#e5e5e5] relative">
                {/* Titanium Badge */}
                {isTitanium && (
                  <span className="absolute bottom-3 left-3 text-[10px] font-black uppercase tracking-[0.18em] bg-stone-900/90 text-stone-100 backdrop-blur-sm px-2.5 py-1 z-10 border border-stone-700 shadow-md flex items-center gap-1.5 rounded-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Titanio
                  </span>
                )}

                {item.img ? (
                  <Image 
                    src={item.img}
                    alt={`Anteojos ${item.category || ''} ${item.brand || ''} ${item.name} en Atelier Óptica Córdoba`}
                    fill
                    // Sin `priority` NI `eager`: este carrusel está DEBAJO del hero,
                    // que reserva su preload para la imagen del LCP.
                    //
                    // Antes esto era `eager` en las 4 primeras, puesto para sacarles
                    // el `priority` y que dejaran de competir por ancho de banda. No
                    // alcanzó: Next igual emite un <link rel="preload"> por cada
                    // imagen eager, así que las 4 seguían compitiendo con el hero
                    // exactamente igual (medido: 7 preloads de imagen en la home,
                    // 6 de ellos de este carrusel). En lazy el navegador las trae
                    // igual antes de que entren en pantalla, sin robarle el ancho
                    // de banda al primer pintado.
                    loading="lazy"
                    sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"
                    className={`object-contain p-6 transition-opacity duration-500 ease-in-out ${item.secondImg ? 'md:group-hover:opacity-0' : ''}`}
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center text-stone-400 text-[10px] font-black uppercase tracking-widest text-center">
                    Sin<br/>Imagen
                  </div>
                )}

                {item.secondImg && (
                  <Image 
                    src={item.secondImg}
                    alt={`${item.name} Try-On`}
                    fill
                    // Ídem, y acá pesa más: esta segunda imagen solo se ve al pasar
                    // el mouse por encima (opacity-0 hasta el hover), así que en
                    // celular no se muestra NUNCA — y aun así se precargaba.
                    loading="lazy"
                    sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out"
                  />
                )}
              </div>
              
              {/* Nombre, precio y botones de acción */}
              <div className="px-5 pt-6 pb-4 border-r border-[#e5e5e5] flex flex-col justify-between min-h-[150px] h-auto">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[12px] font-bold text-stone-900 line-clamp-1 uppercase tracking-wide">{item.name}</h3>
                    {isTitanium && (
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Titanio
                      </span>
                    )}
                  </div>
                
                <div className="mt-1 pr-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    {/* El valor GRANDE es el de transferencia (pedido de
                        Ishtar, 31/8): es el precio que decide la compra. Las
                        cuotas quedan abajo como formas de pago — las 12 se
                        dicen "fijas", sin el % (promo-cuotas.ts). */}
                    {item.rawPrice ? (
                      (() => {
                        const v = PricingService.preciosVidriera(item.rawPrice, 15);
                        return (
                          <p className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-medium text-emerald-700 whitespace-nowrap">Transferencia 15% OFF</span>
                            <span className="text-[15px] font-black text-stone-900 tracking-tight whitespace-nowrap">
                              ${v.contado.toLocaleString("es-AR")}
                            </span>
                            <span className="text-[10px] text-stone-500 font-medium">
                              {textoCuotas12(v.cuota12)}
                            </span>
                            <span className="text-[10px] text-stone-500 font-medium">
                              6 cuotas sin interés de ${v.cuota6.toLocaleString("es-AR")}
                            </span>
                          </p>
                        );
                      })()
                    ) : item.price.includes("$") ? (
                      <p className="flex flex-col">
                        <span className="text-[10px] font-medium text-stone-500 whitespace-nowrap">
                          {item.price.slice(0, item.price.indexOf("$")).trim()}
                        </span>
                        <span className="text-[13px] font-black text-stone-900 tracking-tight whitespace-nowrap">
                          {item.price.slice(item.price.indexOf("$"))}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[13px] font-black text-stone-900 tracking-tight">
                        {item.price}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-row flex-wrap gap-1 sm:flex-col sm:items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                      15% OFF 🔥
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                      Envío Gratis
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <span className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 bg-black text-white hover:bg-stone-800 transition-colors rounded-full text-center">
                  Comprar
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const productModelName = `${item.brand || ''} ${item.model || item.name}`.trim();
                    const text = `Hola Atelier! Me interesa el modelo ${productModelName} y me gustaría recibir asesoramiento.`;
                    // Es un <button> con window.open, no un <a>, así que el
                    // interceptor global de WhatsAppAttribution no lo veía: los
                    // clics desde el carrusel de la home no quedaban medidos.
                    trackWhatsAppClick(`home-carrusel:${productModelName}`);
                    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                  className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3.5 py-2 border border-stone-200 text-stone-700 hover:border-[#25D366] hover:text-[#25D366] transition-colors rounded-full cursor-pointer bg-white"
                >
                  <WhatsAppIcon className="w-3 h-3" />
                  WhatsApp
                </button>
              </div>
            </div>
          </Link>
        );
        })}

        {/* A-10/A-22: el recorrido termina en una salida al catálogo. Antes
            terminaba en la lista repetida, que hacía parecer que el catálogo
            eran 12 modelos. */}
        <Link
          href="/tienda"
          className="group flex-shrink-0 snap-start w-[45vw] md:w-[33vw] lg:w-[25vw] flex flex-col items-center justify-center gap-3 border-r border-[#e5e5e5] bg-[#faf8f5] hover:bg-white transition-colors px-6 text-center"
        >
          <span className="text-3xl font-serif tracking-tight text-stone-900">{totalCount}</span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-600 leading-relaxed">
            modelos en total
          </span>
          <span className="mt-1 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-black text-white group-hover:bg-stone-800 transition-colors rounded-full">
            Ver todos
          </span>
        </Link>
      </div>

      {/* FIXED FOOTER CTA */}
      <div className="w-full max-w-7xl mx-auto px-5 mt-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-[11px] text-stone-500 tracking-wider text-center md:text-left">
          <span className="font-bold text-black">{totalCount} modelos disponibles</span> — sol, receta y ediciones limitadas
        </p>
        
        <Link 
          href="/tienda" 
          className="w-full md:w-auto px-8 py-4 bg-black text-white text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors text-center rounded-sm"
        >
          Ver todos los modelos →
        </Link>
      </div>
    </section>
  );
}
