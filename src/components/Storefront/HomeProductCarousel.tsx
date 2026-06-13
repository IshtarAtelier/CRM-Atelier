"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

import { WHATSAPP_PHONE } from "@/lib/constants";

interface CarouselProduct {
  id: string | number;
  name: string;
  price: string;
  img: string;
  slug: string;
  stock?: number;
  brand?: string | null;
  model?: string | null;
}

interface Props {
  products: CarouselProduct[];
}

export function HomeProductCarousel({ products }: Props) {
  const carouselRef = useRef<HTMLDivElement>(null);

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
      container.removeEventListener('mouseleave', onStopInteract);
      container.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimeout);
    };
  }, [products]);

  // Si la lista está vacía, no mostramos nada o manejamos fallback,
  // pero asumimos que el componente de servidor ya preparó los productos.
  if (!products || products.length === 0) return null;

  return (
    <section className="w-full bg-white pb-20">
      <div 
        ref={carouselRef}
        className="flex w-full overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Duplicamos para el loop infinito suave */}
        {[...products, ...products].map((item, i) => (
          <Link 
            href={`/producto/${item.slug}`} 
            key={`${item.id}-${i}`} 
            className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-shadow duration-500 hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
          >
            {/* Contenedor de imagen — fondo gris muy claro */}
            <div className="bg-[#f5f5f5] aspect-square overflow-hidden border-r border-[#e5e5e5] relative isolate">
              {/* Badge Urgencia / Escasez */}
              {item.stock !== undefined && item.stock > 0 && item.stock <= 3 && (
                <span className="absolute top-3 right-3 z-10 bg-red-650 text-white text-[7.5px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded shadow-md animate-pulse">
                  Últimas {item.stock} u.
                </span>
              )}

              {item.img ? (
                <Image 
                  src={item.img}
                  alt={item.name}
                  fill
                  priority={i < 2}
                  loading={i < 2 ? undefined : 'lazy'}
                  style={{ transform: "translateZ(0)" }}
                  sizes="(max-width: 768px) 45vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain p-6 mix-blend-multiply "
                />
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center text-stone-400 text-[10px] font-black uppercase tracking-widest text-center">
                  Sin<br/>Imagen
                </div>
              )}
            </div>
            
            {/* Nombre, precio y botones de acción */}
            <div className="px-3 pt-6 pb-4 border-r border-[#e5e5e5] flex flex-col justify-between min-h-[150px] h-auto">
              <div>
                <h3 className="text-[12px] font-medium text-stone-800 line-clamp-1">{item.name}</h3>
                <p className="text-[12px] text-[#999] mt-0.5">{item.price}</p>

                {/* Sellos de Confianza (Trust Badges) */}
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-[6.5px] md:text-[7.5px] font-black uppercase tracking-wider bg-stone-50 border border-stone-200/50 text-stone-500 px-1.5 py-0.5 rounded-sm">6 Cuotas</span>
                  <span className="text-[6.5px] md:text-[7.5px] font-black uppercase tracking-wider bg-stone-50 border border-stone-200/50 text-stone-500 px-1.5 py-0.5 rounded-sm">Envío Gratis</span>
                  <span className="text-[6.5px] md:text-[7.5px] font-black uppercase tracking-wider bg-amber-50/50 border border-amber-500/20 text-[#b08f4c] px-1.5 py-0.5 rounded-sm font-semibold">Garantía</span>
                  <span className="text-[6.5px] md:text-[7.5px] font-black uppercase tracking-wider bg-emerald-50/50 border border-emerald-500/20 text-emerald-700 px-1.5 py-0.5 rounded-sm font-semibold">15% OFF</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-widest px-3.5 py-2 bg-black text-white hover:bg-stone-800 transition-colors rounded-full text-center">
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
                  className="text-[8px] font-black uppercase tracking-widest px-3.5 py-2 border border-stone-200 text-stone-600 hover:border-black hover:text-black transition-colors rounded-full text-center cursor-pointer bg-white"
                >
                  Consultar
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
