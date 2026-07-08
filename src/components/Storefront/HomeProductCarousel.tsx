"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { WHATSAPP_PHONE } from "@/lib/constants";

interface CarouselProduct {
  id: string | number;
  name: string;
  price: string;
  rawPrice?: number;
  img: string;
  slug: string;
  stock?: number;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  secondImg?: string | null;
}

interface Props {
  collections: {
    destacados: CarouselProduct[];
    sol: CarouselProduct[];
    receta: CarouselProduct[];
    nuevos: CarouselProduct[];
  };
  totalCount: number;
}

type TabKey = 'destacados' | 'sol' | 'receta' | 'nuevos';

export function HomeProductCarousel({ collections, totalCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('destacados');
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const products = collections[activeTab] || [];

  // Hybrid Marquee Logic
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    let animationId: number;
    let isInteracting = false;

    const onInteract = () => { isInteracting = true; };
    const onStopInteract = () => { isInteracting = false; };

    container.addEventListener('touchstart', onInteract, { passive: true });
    container.addEventListener('touchend', onStopInteract, { passive: true });
    container.addEventListener('mousedown', onInteract, { passive: true });
    container.addEventListener('mouseup', onStopInteract, { passive: true });
    container.addEventListener('mouseenter', onInteract, { passive: true });
    container.addEventListener('mouseleave', onStopInteract, { passive: true });

    let wheelTimeout: any;
    const onWheel = () => {
      isInteracting = true;
      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(() => {
        isInteracting = false;
      }, 500);
    };
    container.addEventListener('wheel', onWheel, { passive: true });

    let scrollAccumulator = 0;
    const scroll = () => {
      if (!isInteracting) {
        scrollAccumulator += 1; // 1 pixel per frame (approx 60px/s)
        if (scrollAccumulator >= 1) {
          const shift = Math.floor(scrollAccumulator);
          container.scrollLeft += shift;
          scrollAccumulator -= shift;
          
          if (container.scrollLeft >= container.scrollWidth / 2) {
            container.scrollLeft -= container.scrollWidth / 2;
          }
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('touchstart', onInteract);
      container.removeEventListener('touchend', onStopInteract);
      container.removeEventListener('mousedown', onInteract);
      container.removeEventListener('mouseup', onStopInteract);
      container.removeEventListener('mouseenter', onInteract);
      container.removeEventListener('mouseleave', onStopInteract);
      container.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimeout);
    };
  }, [products]);

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
          { key: 'sol', label: 'ClipOn' },
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
        className="flex w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Duplicamos para el loop infinito suave */}
        {[...products, ...products].map((item, i) => {
          const isTitanium = (item.model || '').toUpperCase().includes('TG') || (item.name || '').toUpperCase().includes('TITANIUM');
          return (
            <Link 
              href={`/producto/${item.slug}`} 
              key={`${item.id}-${i}`} 
              className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-shadow duration-500 hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
            >
              {/* Contenedor de imagen — fondo gris muy claro */}
              <div className="bg-[#f5f5f5] aspect-square overflow-hidden border-r border-[#e5e5e5] relative isolate">
                {/* Badge Urgencia / Escasez */}
                {item.stock !== undefined && item.stock > 0 && item.stock <= 3 && (
                  <span className="absolute top-3 right-3 z-10 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded shadow-md animate-pulse">
                    Últimas {item.stock} u.
                  </span>
                )}

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
                    priority={i < 4}
                    loading={i < 4 ? "eager" : "lazy"}
                    sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"
                    className={`object-contain p-6 mix-blend-multiply transition-opacity duration-500 ease-in-out ${item.secondImg ? 'md:group-hover:opacity-0' : ''}`}
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
                    priority={i < 2}
                    loading={i < 2 ? "eager" : "lazy"}
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
                    {item.price.includes("$") ? (
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
                    {item.rawPrice && (
                      <p className="text-[10px] text-stone-500 font-medium">
                        ${Math.round(item.rawPrice * 0.85).toLocaleString("es-AR")} eft/transf
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
