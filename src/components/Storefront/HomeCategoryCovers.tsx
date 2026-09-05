import Link from "next/link";
import Image from "next/image";
import type { CarouselProduct } from "@/lib/home-fallback";
import { primeraFotoQueExiste } from "@/lib/catalog/foto-portada";

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
// EL FORMATO: BANDAS ANCHAS EN CELULAR, TRES COLUMNAS EN ESCRITORIO
// La primera versión eran tres cuadraditos en fila también en celular, para
// ahorrar alto. Ishtar las rechazó ("no me gusta") y tenía razón: con tres en
// fila el anteojo queda diminuto, y ella pidió PORTADAS — claras y con el
// anteojo grande (mismo criterio con el que rechazó las placas oscuras y
// minimalistas el 1/9). Un mosaico apretado no es una portada.
// Ahora en celular es una banda ancha por categoría: la foto grande a la
// izquierda, el nombre en serif y el conteo a la derecha. De `sm` para arriba
// vuelven a ser tres columnas, donde el ancho alcanza para que la foto respire.
// Cuesta ~200 px más de alto en celular que la versión apretada; es el precio
// de que se vea, y el alto del home es un tema aparte que ya está anotado.
// ────────────────────────────────────────────────────────────────────────────

interface Portada {
  slug: string;
  etiqueta: string;
  href: string;
  /** El producto YA elegido en el servidor, con foto verificada. */
  producto?: CarouselProduct;
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
    { slug: "receta", etiqueta: "Receta", href: "/receta", producto: primeraFotoQueExiste(receta), total: conteos?.receta },
    { slug: "sol", etiqueta: "Sol", href: "/lentes-de-sol", producto: primeraFotoQueExiste(sol), total: conteos?.sol },
    { slug: "clipon", etiqueta: "Clip-On", href: "/clip-on", producto: primeraFotoQueExiste(clipon), total: conteos?.clipon },
  ];

  // Una portada sin foto no se dibuja: un recuadro vacío con un nombre adentro
  // se lee como algo roto, no como una categoría. Si una categoría se queda sin
  // stock, su puerta simplemente no aparece.
  const visibles = portadas.filter((p) => p.producto?.img);

  if (visibles.length === 0) return null;

  return (
    <section className="w-full bg-white pb-14 px-5">
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8a6d3b] mb-4">
          Elegí por tipo
        </h2>

        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
          {visibles.map((p) => (
            <Link
              key={p.slug}
              href={p.href}
              className="group flex flex-row sm:flex-col items-stretch rounded-2xl overflow-hidden border border-[#e5e5e5] bg-[#faf8f5] hover:border-stone-900 transition-colors"
            >
              <div className="relative w-[45%] shrink-0 sm:w-full aspect-square bg-white overflow-hidden">
                <Image
                  unoptimized={String(p.producto!.img).startsWith("data:")}
                  src={p.producto!.img}
                  alt={`Anteojos de ${p.etiqueta.toLowerCase()} en Atelier Óptica`}
                  fill
                  sizes="(max-width: 640px) 45vw, 25vw"
                  className="object-contain p-2 sm:p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex-1 flex flex-col justify-center px-5 py-4 sm:px-4 sm:py-4">
                <p className="text-2xl sm:text-xl font-serif tracking-tight text-stone-900 leading-none">
                  {p.etiqueta}
                </p>
                {/* El número solo si es real. Sin dato (home servida desde el
                    snapshot) no se inventa uno. */}
                {typeof p.total === "number" && p.total > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-500 mt-1.5">
                    {p.total} {p.total === 1 ? "modelo" : "modelos"}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8a6d3b]">
                  Ver todos
                  <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
