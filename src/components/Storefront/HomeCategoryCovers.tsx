"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CarouselProduct } from "@/lib/home-fallback";

// ────────────────────────────────────────────────────────────────────────────
// Las tres puertas del catálogo: Receta, Sol y Clip-On.
//
// QUÉ PROBLEMA RESUELVE (auditoría del 5/9/26)
// Las tres páginas por categoría —/receta, /lentes-de-sol, /clip-on— YA EXISTÍAN,
// salen enteras del servidor y las indexa Google. Pero no se llegaba a ellas
// desde ningún lado del home: los únicos enlaces vivían en el PIE de página y
// en el 404 de un producto. En la práctica el camino para ver solo lentes de
// sol era: Explorar → /tienda (catálogo completo) → tocar el chip SOL → que
// filtra en el cliente. Dos clics, con el catálogo entero parpadeando primero
// (está documentado en tienda/page.tsx), y terminabas en
// `/tienda?categoria=Sol`, que para Google vale menos que `/lentes-de-sol`.
// Estas portadas son ese atajo: un clic desde el home a la página que ya
// existía y nadie encontraba.
//
// POR QUÉ LA FOTO ES UN PRODUCTO REAL Y NO UNA IMAGEN DE CATÁLOGO
// Hay banners viejos en `public/images/banners/` de cuando /tienda tenía hero
// (sol.png, receta.png, clipon.png). No se usan, por dos motivos: el de Sol
// muestra "LUNETTES EST. 1968" —una marca que no es Atelier— y los tres son
// oscuros y de ambiente, el estilo que Ishtar rechazó el 1/9 para las placas
// ("claras, con el anteojo grande"). La foto de acá sale del catálogo vivo:
// es un anteojo que de verdad está a la venta, nunca se desactualiza y no hay
// un archivo nuevo que mantener.
//
// POR QUÉ AGUANTA UNA FOTO QUE NO EXISTE
// Auditando esto se encontró que 24 de los 116 productos publicados apuntan a
// `/images/products/`, y varios de esos archivos NO están (nestor-c1, apolo-c2,
// ares-c2, febo-c1… dan 404 también en producción). El carrusel ya venía
// mostrando esos huecos al abrir su solapa; acá se nota más porque la portada
// es UNA sola foto. Si la imagen falla, el mosaico no queda roto: muestra un
// marco neutro y sigue funcionando como puerta (nombre, conteo y enlace). El
// dato de fondo hay que arreglarlo aparte — no es cosa de esta sección.
//
// POR QUÉ TRES EN FILA TAMBIÉN EN CELULAR
// El home ya está 1.110 px por encima de su tope de altura. Apiladas, estas
// tres portadas sumarían ~600 px; en fila, ~200. Y las tres juntas se leen
// como lo que son: las tres opciones de una misma decisión, no tres secciones.
// ────────────────────────────────────────────────────────────────────────────

interface Portada {
  slug: string;
  etiqueta: string;
  href: string;
  /** Todos los de la categoría: si la foto del primero no carga, se prueba el
   *  siguiente. Ya vienen en las props del home, no cuesta una consulta más. */
  productos: CarouselProduct[];
  total?: number;
}

export function HomeCategoryCovers({
  receta,
  sol,
  clipon,
  conteos,
}: {
  receta: CarouselProduct[];
  sol: CarouselProduct[];
  clipon: CarouselProduct[];
  /** Totales reales por categoría. Puede faltar si la home se sirve desde el
   *  snapshot de emergencia; en ese caso no se muestra ningún número. */
  conteos?: { receta: number; sol: number; clipon: number };
}) {
  const portadas: Portada[] = [
    { slug: "receta", etiqueta: "Receta", href: "/receta", productos: (receta || []).filter(x => x?.img), total: conteos?.receta },
    { slug: "sol", etiqueta: "Sol", href: "/lentes-de-sol", productos: (sol || []).filter(x => x?.img), total: conteos?.sol },
    { slug: "clipon", etiqueta: "Clip-On", href: "/clip-on", productos: (clipon || []).filter(x => x?.img), total: conteos?.clipon },
  ];

  // Una portada sin foto no se dibuja: un recuadro vacío con un nombre adentro
  // se lee como algo roto, no como una categoría. Si una categoría se queda sin
  // stock, su puerta simplemente no aparece.
  const visibles = portadas.filter((p) => p.productos.length > 0);

  // Con qué producto de cada categoría se está intentando. No se puede saber
  // desde el servidor si un archivo existe: se descubre al fallar la carga y
  // se avanza al siguiente.
  const [indice, setIndice] = useState<Record<string, number>>({});

  if (visibles.length === 0) return null;

  return (
    <section className="w-full bg-white pb-14 px-5">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-500 mb-4">
          Elegí por tipo
        </h2>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {visibles.map((p) => (
            <Link
              key={p.slug}
              href={p.href}
              className="group flex flex-col rounded-xl overflow-hidden border border-[#e5e5e5] bg-[#faf8f5] hover:border-stone-900 transition-colors"
            >
              <div className="relative aspect-square bg-white overflow-hidden">
                {(() => {
                  const i = indice[p.slug] ?? 0;
                  const producto = p.productos[i];
                  if (!producto) {
                    // Se acabaron los candidatos: ninguna foto de la categoría
                    // cargó. Marco neutro, la puerta sigue sirviendo.
                    return (
                      <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                    );
                  }
                  return (
                    <Image
                      key={producto.img}
                      unoptimized={String(producto.img).startsWith("data:")}
                      src={producto.img}
                      alt={`Anteojos de ${p.etiqueta.toLowerCase()} en Atelier Óptica`}
                      fill
                      sizes="(max-width: 640px) 33vw, 25vw"
                      onError={() => setIndice((prev) => ({ ...prev, [p.slug]: (prev[p.slug] ?? 0) + 1 }))}
                      className="object-contain p-3 sm:p-5 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                    />
                  );
                })()}
              </div>
              <div className="px-2.5 py-2.5 sm:px-4 sm:py-3">
                <p className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest text-stone-900 leading-tight">
                  {p.etiqueta}
                </p>
                {/* El número solo si es real. Sin dato (home servida desde el
                    snapshot) no se inventa uno. */}
                {typeof p.total === "number" && p.total > 0 && (
                  <p className="text-[10px] sm:text-[11px] text-stone-500 mt-0.5">
                    {p.total} {p.total === 1 ? "modelo" : "modelos"}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
