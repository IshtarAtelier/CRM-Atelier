"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface CarouselProduct {
  id: string | number;
  name: string;
  price: string;
  img: string;
  slug: string;
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
        className="flex w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Quadruplicamos para el loop infinito suave */}
        {[...products, ...products, ...products, ...products].map((item, i) => (
          <Link 
            href={`/producto/${item.slug}`} 
            key={`${item.id}-${i}`} 
            className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-shadow duration-500 hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
          >
            {/* Contenedor de imagen — fondo gris muy claro */}
            <div className="bg-[#f5f5f5] aspect-square overflow-hidden border-r border-[#e5e5e5] relative">
              {item.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={item.img}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-contain p-6 mix-blend-multiply group-hover:scale-110 transition-transform duration-500 ease-out"
                />
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center text-stone-400 text-[10px] font-black uppercase tracking-widest text-center">
                  Sin<br/>Imagen
                </div>
              )}
            </div>
            
            {/* Nombre y precio — tipografía GM exacta */}
            <div className="px-3 pt-6 pb-4 border-r border-[#e5e5e5] h-full">
              <h3 className="text-[13px] font-medium">{item.name}</h3>
              <p className="text-[13px] text-[#999] mt-0.5">{item.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
