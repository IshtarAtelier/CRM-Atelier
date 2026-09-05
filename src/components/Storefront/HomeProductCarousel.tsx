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
  /** Totales reales por categoría, para que la salida del carrusel sepa
   *  cuántos hay de la solapa que se está mirando. Opcional: sin el dato, la
   *  salida se comporta como siempre (todo el catálogo). */
  conteos?: { clipon: number; sol: number; receta: number };
}

type TabKey = 'destacados' | 'clipon' | 'sol' | 'receta' | 'nuevos';

/**
 * A dónde lleva la salida del carrusel y qué dice, según la solapa abierta.
 *
 * EL PASO DE MÁS QUE SACA (auditoría 5/9/26): estando en la solapa "Sol", la
 * placa del final decía "106 modelos · Ver todos" y llevaba al catálogo
 * COMPLETO. O sea: filtrabas, querías más de lo mismo, y la salida te devolvía
 * sin filtrar para que volvieras a filtrar allá. Ahora cada solapa sale a su
 * propia página, que además ya existía y sale entera del servidor.
 */
function salidaDeLaSolapa(
  tab: TabKey,
  totalCount: number,
  conteos?: { clipon: number; sol: number; receta: number },
): { href: string; numero: number; etiqueta: string } {
  if (tab === 'sol' && conteos?.sol) return { href: '/lentes-de-sol', numero: conteos.sol, etiqueta: 'lentes de sol' };
  if (tab === 'receta' && conteos?.receta) return { href: '/receta', numero: conteos.receta, etiqueta: 'de receta' };
  if (tab === 'clipon' && conteos?.clipon) return { href: '/clip-on', numero: conteos.clipon, etiqueta: 'clip-on' };
  // "Destacados" y "Nuevos" no son categorías del catálogo: son recortes. Su
  // salida natural sigue siendo la tienda entera.
  return { href: '/tienda', numero: totalCount, etiqueta: 'modelos en total' };
}

export function HomeProductCarousel({ collections, totalCount, conteos }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('destacados');
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const products = collections[activeTab] || [];
  // A dónde sale el carrusel según la solapa abierta (ver salidaDeLaSolapa).
  const salida = salidaDeLaSolapa(activeTab, totalCount, conteos);

  // ── Movimiento automático del carrusel ───────────────────────────────────
  //
  // Historia corta: acá había un "marquee híbrido" que empujaba `scrollLeft` un
  // píxel por frame, con la lista de productos DUPLICADA para que el loop se
  // viera continuo. Se sacó entero por dos problemas medidos (A-10 y A-22):
  // la rueda del mouse movía el carrusel en vez de bajar la página, y quien
  // llegaba al final veía los mismos anteojos otra vez y concluía que el
  // catálogo son 12 modelos, no 112. Al sacarlo quedó quieto, e Ishtar pidió el
  // movimiento de vuelta (2/9/26).
  //
  // Vuelve, pero de la forma que el plan autoriza (F2-06), que arregla las dos
  // cosas sin perder el movimiento:
  //   · El clon existe SOLO para que el loop se vea continuo, y va marcado con
  //     `aria-hidden` y `tabIndex={-1}`: no lo lee un lector de pantalla, no lo
  //     indexa Google y no duplica impresiones en la medición. El catálogo
  //     sigue diciendo la verdad sobre su tamaño.
  //   · NO se registra ningún listener de `wheel`. El scroll vertical nunca es
  //     capturado: la rueda baja la página, siempre. Lo único que pausa es
  //     `pointerenter` (mouse encima) y el arrastre con el dedo.
  //   · Con `prefers-reduced-motion` no se mueve nada. Quien pidió menos
  //     movimiento no recibe una cinta transportadora.
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let animationId = 0;
    let pausado = false;
    const pausar = () => { pausado = true; };
    const reanudar = () => { pausado = false; };

    // Ojo: `pointerenter`/`pointerleave`, no `mouseenter`. Con el dedo, el
    // pointer "entra" y no sale nunca, así que tras arrastrar una vez el
    // carrusel quedaría congelado para siempre en celular.
    container.addEventListener('pointerenter', pausar);
    container.addEventListener('pointerleave', reanudar);
    container.addEventListener('touchstart', pausar, { passive: true });
    container.addEventListener('touchend', reanudar, { passive: true });

    let acumulado = 0;
    const avanzar = () => {
      if (!pausado) {
        acumulado += 0.6; // ~36 px/s: se nota que vive, no marea
        if (acumulado >= 1) {
          const paso = Math.floor(acumulado);
          container.scrollLeft += paso;
          acumulado -= paso;
          // La lista real ocupa la primera mitad; al pasarla, se vuelve al
          // principio sin que se note, porque lo que sigue es su clon idéntico.
          const mitad = container.scrollWidth / 2;
          if (mitad > 0 && container.scrollLeft >= mitad) container.scrollLeft -= mitad;
        }
      }
      animationId = requestAnimationFrame(avanzar);
    };
    animationId = requestAnimationFrame(avanzar);

    return () => {
      cancelAnimationFrame(animationId);
      container.removeEventListener('pointerenter', pausar);
      container.removeEventListener('pointerleave', reanudar);
      container.removeEventListener('touchstart', pausar);
      container.removeEventListener('touchend', reanudar);
    };
  }, [products]);

  // Reset scroll when tab changes
  useEffect(() => {
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }
  }, [activeTab]);

  /**
   * Una tanda de cards. Se pinta DOS veces: la real y su clon.
   *
   * El clon existe solo para que el loop se vea continuo — el auto-scroll
   * vuelve al principio al pasar la mitad del ancho, y como lo que sigue es
   * idéntico, el salto no se nota. Va con `aria-hidden` y `tabIndex={-1}`: no
   * lo lee un lector de pantalla, no lo indexa Google y no duplica impresiones
   * en la medición, que era el daño de la versión vieja (A-22).
   *
   * Las dos tandas terminan con la card de salida al catálogo, así las dos
   * mitades miden exactamente lo mismo y la cuenta de `scrollWidth / 2` da
   * justo. Si una mitad tuviera un elemento de más, el loop saltaría.
   */
  const renderTanda = (esClon: boolean) => (
    <>
      {products.map((item, i) => {
          const isTitanium = (item.model || '').toUpperCase().includes('TG') || (item.name || '').toUpperCase().includes('TITANIUM');
          return (
            <Link 
              href={`/producto/${item.slug}`} 
              key={`${esClon ? "clon-" : ""}${item.id}-${i}`}
              aria-hidden={esClon || undefined}
              tabIndex={esClon ? -1 : undefined}
              
              className="group flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] block transition-shadow duration-500 hover:z-10 relative bg-white hover:shadow-[0_0_40px_rgba(0,0,0,0.05)]"
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
                    {/* Acá había un segundo chip "Titanio". La misma tarjeta ya lo
                        dice sobre la foto, y de paso le robaba el ancho al nombre:
                        "Aquiles C4" se mostraba como "AQUILE…". */}
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
                            {/* Las cuotas van SIEMPRE, también en celular (pedido
                                de Ishtar, 5/9). El 2/9 se habían ocultado en
                                celular junto con las de /tienda; se revierte por
                                el mismo motivo: el valor de la cuota es parte de
                                lo que decide la compra. Los importes salen de
                                PricingService. */}
                            <span className="block text-[10px] text-stone-500 font-medium">
                              {textoCuotas12(v.cuota12)}
                            </span>
                            <span className="block text-[10px] text-stone-500 font-medium">
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
                    {/* Acá había un "15% OFF 🔥" en TODAS las tarjetas. Ese 15%
                        es cierto, pero es una CONDICIÓN DE PAGO (efectivo o
                        transferencia), no una oferta: no depende del producto y
                        está en todos por igual. La misma tarjeta ya lo dice, dos
                        centímetros a la izquierda, como "Transferencia 15% OFF".
                        Con el mismo cartel en las 106, el ojo lo deja de ver a la
                        tercera — y quemaba el único lugar donde una rebaja real
                        podría gritarse. Es el mismo criterio que ya se aplicó en
                        la grilla de /tienda. */}
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
                  tabIndex={esClon ? -1 : undefined}
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
          href={salida.href}
          aria-hidden={esClon || undefined}
          tabIndex={esClon ? -1 : undefined}
          className="group relative flex-shrink-0 w-[45vw] md:w-[33vw] lg:w-[25vw] flex flex-col items-center justify-center gap-3 overflow-hidden bg-stone-950 px-6 text-center"
        >
          {/* Placa negra (pedido de Ishtar, 2/9). El resplandor dorado no es
              adorno: la tarjeta es lo último de una fila de fondos blancos, y
              contra ese blanco un negro plano se leía como un hueco. El halo la
              vuelve el punto final del recorrido.
              El dorado es #c8a55c, que es el tono que la tabla de contraste de
              globals.css marca para FONDO OSCURO — el claro (#8a6d3b) acá no
              llegaría al piso de 4,5:1. */}
          <div
            className="absolute -top-1/3 left-1/2 h-[130%] w-[130%] -translate-x-1/2 rounded-full bg-[var(--dorado)]/15 blur-[70px] transition-opacity duration-500 group-hover:opacity-70 pointer-events-none"
            aria-hidden="true"
          />

          <span className="relative text-4xl md:text-5xl font-serif tracking-tight text-white">
            {salida.numero}
          </span>
          <span className="relative text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-[var(--dorado)] leading-relaxed">
            {salida.etiqueta}
          </span>
          <span className="relative mt-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-5 py-2.5 bg-[var(--dorado)] text-stone-950 rounded-full transition-transform duration-300 group-hover:scale-105">
            Ver todos
            <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
          </span>
        </Link>
    </>
  );

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

      {/* SIN scroll-snap y SIN scroll-smooth, a propósito.
          Los dos son incompatibles con el movimiento automático y lo dejaban
          inmóvil:
            · `scroll-smooth` anima cada asignación de scrollLeft, así que los
              pasos de 1 px por frame nunca llegan a destino.
            · `scroll-snap`, incluso en `proximity`, trata cada avance de 1 px
              como un scroll que terminó y devuelve el carrusel al punto de
              anclaje más cercano — que es la card actual. Vuelve a 0 siempre.
          El plan pedía snap (F0-04), pero eso era EN LUGAR del auto-scroll: son
          dos formas distintas de resolver lo mismo y no conviven. Elegido el
          movimiento, el snap se va. El arrastre con el dedo sigue funcionando
          igual, solo que sin imantarse a la card. */}
      <div 
        ref={carouselRef}
        className="flex w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {renderTanda(false)}
        {renderTanda(true)}
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
