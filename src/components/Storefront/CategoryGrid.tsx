"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { resolveStorageUrl } from "@/lib/utils/storage";

import Image from "next/image";

interface CategoryGridProps {
  products: any[];
  emptyMessage?: string;
  categoryName: string;
}

export function CategoryGrid({ products, emptyMessage = "Estamos actualizando nuestro catálogo.", categoryName }: CategoryGridProps) {
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
        const isSmallFrame = modelLower.includes('tl3932 c3') || modelLower.includes('diana') || p.id === 'cmq5d11hf002rhy61fhvqs7nj';
        const imagePaddingClass = isSmallFrame ? 'p-0 scale-125' : 'p-6';

        return (
          <motion.div 
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.5 }}
            className="group cursor-pointer flex flex-col"
          >
            <Link href={`/producto/${p.slug}`} className="flex-1 flex flex-col">
              <div className="relative aspect-square mb-4 bg-[#fdfdfd] border border-[#f0f0f0] overflow-hidden rounded-xl isolate">
                <Image 
                  src={imageUrl} 
                  alt={`${p.brand} ${p.model}`}
                  fill
                  unoptimized
                  style={{ transform: "translateZ(0)" }}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className={`object-contain mix-blend-multiply transition-all duration-700 ease-in-out ${imagePaddingClass} ${hasSecondImage ? 'md:group-hover:opacity-0 md:group-hover:scale-105' : 'md:group-hover:scale-105'}`}
                />

                {hasSecondImage && secondImageUrl && (
                  <Image 
                    src={secondImageUrl} 
                    alt={`${p.brand} ${p.model} Try-On`}
                    fill
                    unoptimized
                    style={{ transform: "translateZ(0)" }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover opacity-0 md:group-hover:opacity-100 transition-all duration-700 ease-in-out md:group-hover:scale-105"
                  />
                )}
                
                {/* Etiqueta de Stock / Promo */}
                {p.stock === 0 && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                    Agotado
                  </div>
                )}
                {p.isFeatured && p.stock > 0 && (
                  <div className="absolute top-3 right-3 bg-black text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                    Destacado
                  </div>
                )}
              </div>

              <div className="flex flex-col flex-1 px-1">
                <h3 className="text-xs text-stone-500 font-bold uppercase tracking-widest mb-1">{p.brand}</h3>
                <h2 className="text-lg font-serif tracking-tight text-stone-900 dark:text-white mb-2 leading-tight flex-1">{p.model}</h2>
                <div className="flex items-end justify-between mt-auto">
                  <p className="text-base font-light tracking-tight text-black dark:text-white">
                    ${(p.price || 0).toLocaleString()}
                  </p>
                  <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Ver detalles</span>
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
