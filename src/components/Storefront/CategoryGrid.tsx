"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { PricingService } from "@/services/PricingService";
import { leerPromoCuotas } from "@/lib/promo-cuotas";
import { resolveStorageUrl } from "@/lib/utils/storage";
import { precioConOferta } from "@/lib/precio-oferta";

import Image from "next/image";

interface CategoryGridProps {
  products: any[];
  emptyMessage?: string;
  categoryName: string;
}

export function CategoryGrid({ products, emptyMessage = "Estamos actualizando nuestro catálogo.", categoryName }: CategoryGridProps) {
  const [webSettings, setWebSettings] = useState({
    web_promo_cash_discount: 15,
    web_promo_installments: "6 cuotas sin interés"
  });

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setWebSettings({
            web_promo_cash_discount: data.web_promo_cash_discount !== undefined ? Number(data.web_promo_cash_discount) : 15,
            web_promo_installments: data.web_promo_installments || "6 cuotas sin interés"
          });
        }
      })
      .catch(err => console.error("Error loading web settings for category grid:", err));
  }, []);

  // El parseo de `web_promo_installments` vive en `promo-cuotas.ts` y en ningún
  // otro lado: estaba copiado a mano acá, en TiendaClient y en LensConfigurator,
  // y como sacaba el número con `match(/\d+/)` sobre texto libre, escribir
  // "12 cuotas" en /admin/web hacía que esta grilla renderizara sola
  // "12 s/interés de $lista/12" — la frase prohibida, con el precio mal.
  const promo = leerPromoCuotas(webSettings.web_promo_installments);
  const installmentsCount = promo.cantidad;
  const discountRate = webSettings.web_promo_cash_discount / 100;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-xl text-stone-600 dark:text-stone-400 mb-8 max-w-lg">
          {emptyMessage}
        </p>
        <a 
          href={`https://wa.me/${WHATSAPP_PHONE}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-stone-900 dark:bg-white text-white dark:text-stone-900 font-bold py-4 px-8 rounded-full hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors shadow-lg"
        >
          Consultar stock por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
      {products.map((p, index) => {
        const hasSecondImage = p.imagenesCatalogo && p.imagenesCatalogo.length > 1;

        const rawImageUrl = p.imagenesCatalogo && p.imagenesCatalogo.length > 0 ? resolveStorageUrl(p.imagenesCatalogo[0]) : '';
        const imageUrl = rawImageUrl || p.mockImage || '/images/og-image.jpg';
          
        const rawSecondImageUrl = hasSecondImage ? resolveStorageUrl(p.imagenesCatalogo[1]) : '';
        const secondImageUrl = rawSecondImageUrl || null;


        const modelLower = (p.model || "").toLowerCase();
        const isSmallFrame = modelLower.includes('tl3932 c3') || p.id === 'cmq5d11hf002rhy61fhvqs7nj';
        const isDiana = modelLower.includes('diana');
        const imagePaddingClass = isSmallFrame 
          ? 'p-0 scale-125' 
          : (isDiana ? 'p-0 scale-110' : 'p-6');

        // Fundido por CSS (`.tienda-grid-fade`, ya en globals.css y anulado bajo
        // prefers-reduced-motion) en vez de framer-motion.
        //
        // El fade escalonado (`delay: index * 0.05`) hacía que cada tarjeta
        // entrara a destiempo y quedara ratos en opacidad parcial: los textos
        // medían 3,3-4,1:1 de contraste en vez del color declarado, porque el
        // color efectivo depende de en qué punto del fundido se los mire. Con la
        // animación pareja el texto tiene siempre su color real. De paso, estas
        // pantallas (/receta, /lentes-de-sol, /clip-on) dejan de bajar
        // framer-motion: era su único uso en el componente.
        return (
          <div
            key={p.id}
            className="group cursor-pointer flex flex-col tienda-grid-fade"
          >
            <Link href={`/producto/${p.slug}`} className="flex-1 flex flex-col">
              <div className="relative aspect-square mb-4 bg-white border border-stone-100 overflow-hidden rounded-xl isolate">
                <Image unoptimized={String(imageUrl).startsWith('data:')}
                  src={imageUrl} 
                  alt={`${p.brand} ${p.model}`}
                  fill
                  // Sin `priority`: marcaba 4 miniaturas como prioritarias y Next
                  // emite un <link rel="preload"> por cada una, compitiendo por
                  // ancho de banda con lo que define el primer pintado. Mismo
                  // caso que ya se corrigió en el carrusel de la home.
                  loading="lazy"
                  style={{ transform: "translateZ(0)" }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className={`object-contain mix-blend-multiply transition-opacity duration-500 ease-in-out ${imagePaddingClass} ${hasSecondImage ? 'md:group-hover:opacity-0 ' : ''}`}
                />

                {hasSecondImage && secondImageUrl && (
                  <Image unoptimized={String(secondImageUrl).startsWith('data:')}
                    src={secondImageUrl} 
                    alt={`${p.brand} ${p.model} Try-On`}
                    fill
                    style={{ transform: "translateZ(0)" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-in-out"
                  />
                )}
                
                {/* Etiqueta de Stock / Promo */}
                {p.stock === 0 && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                    Agotado
                  </div>
                )}
                {/* ESQUINA SUPERIOR DERECHA: la OFERTA REAL, igual que en la
                    tienda (pedido de Ishtar, 7/9). Hasta hoy esta grilla NO
                    mostraba las ofertas: un producto rebajado se veía idéntico a
                    uno que no, porque la tarjeta ni miraba `salePrice`.
                    "Destacado" baja a la esquina de abajo para no pelearse con
                    el cartel de la oferta, que es el que decide la compra. */}
                {(() => {
                  const { enOferta, descuentoPct } = precioConOferta(p);
                  if (!enOferta) return null;
                  return (
                    <div className="absolute top-3 right-3 z-10 text-[11px] font-black uppercase tracking-widest text-white bg-rose-600 px-2 py-1 rounded-sm shadow-md">
                      {descuentoPct}% OFF 🔥
                    </div>
                  );
                })()}
                {p.isFeatured && p.stock > 0 && (
                  <div className="absolute bottom-3 right-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded z-10">
                    Destacado
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 px-1">
                {/* Marca como <p>: iba como <h3> antes del <h2> del modelo. */}
                <p className="text-[10px] text-stone-600 dark:text-stone-400 font-bold uppercase tracking-[0.20em] mb-1">{p.brand}</p>
                <h2 className="text-lg font-serif tracking-tight text-stone-900 dark:text-white mb-2 leading-tight flex-1">{p.model}</h2>

                {/* Orden de venta (pedido de Ishtar, 27/8): 12 cuotas como
                    ancla, el resto en una sola línea discreta. */}
                {/* MISMO bloque de precio que la tienda (pedido de Ishtar,
                    7/9: "actualizá todo a como está en la tienda principal").
                    Antes acá el ancla era la cuota de 12 y el precio de
                    transferencia iba al final de un renglón corrido: el mismo
                    producto se leía distinto en /tienda y en /clip-on.
                    El orden es el de la tienda: precio de transferencia GRANDE,
                    el 15% en el mismo renglón, y las cuotas una debajo de la
                    otra. Los importes salen de PricingService. */}
                {(() => {
                  const { enOferta } = precioConOferta(p);
                  const base = enOferta ? (p.salePrice || 0) : (p.price || 0);
                  return (
                    <div className="mt-auto pt-2 border-t border-stone-100/60 dark:border-stone-800/40">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">
                          <span className="font-black text-base text-stone-900 dark:text-white">
                            ${Math.round(base * (1 - discountRate)).toLocaleString("es-AR")}
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold"> {webSettings.web_promo_cash_discount}% OFF transf.</span>
                          <span className="block text-xs text-stone-500 dark:text-stone-400">
                            12 cuotas fijas de ${PricingService.cuotasMpLargas(base).installment12.toLocaleString("es-AR")}
                          </span>
                          <span className="block text-xs text-stone-500 dark:text-stone-400">
                            {installmentsCount} cuotas sin interés de ${Math.round(base / installmentsCount).toLocaleString("es-AR")}
                          </span>
                        </p>
                        <span className="text-xs text-stone-900 dark:text-white uppercase tracking-wider font-bold group-hover:text-[#8a6d3b] dark:group-hover:text-[#c8a55c] transition-colors shrink-0 self-start">Ver anteojos ›</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
