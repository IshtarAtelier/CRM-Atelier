import Link from "next/link";
import Image from "next/image";
import type { CarouselProduct } from "@/lib/home-fallback";

// ────────────────────────────────────────────────────────────────────────────
// DÚO DESTACADO DE SOL — dos piezas grandes bajo el carrusel del home.
//
// Server component sin estado: recibe 2 productos YA resueltos por la tubería
// blindada del home (vivo → memoria → snapshot, ver src/lib/catalog/), así que
// hereda la garantía del carrusel: si la home renderiza, esto tiene productos.
// El hover a la segunda foto es CSS puro (group-hover), sin JS que hidratar.
// ────────────────────────────────────────────────────────────────────────────

interface Props {
  products: CarouselProduct[]; // exactamente 2 (la página no renderiza la sección con menos)
}

export function HomeSolShowcase({ products }: Props) {
  return (
    <section className="w-full bg-white pt-14 pb-4">
      <div className="px-5 mb-6">
        <h2 className="text-[13px] font-bold tracking-normal uppercase">
          DESTACADOS DE SOL
        </h2>
        <Link
          href="/lentes-de-sol"
          className="text-[13px] font-medium underline underline-offset-4 decoration-1 hover:opacity-60 transition-opacity mt-1 inline-block"
        >
          VER LENTES DE SOL
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 border-y border-[#e5e5e5]">
        {products.map((item, i) => (
          <Link
            href={`/producto/${item.slug}`}
            key={item.id}
            className={`group relative block bg-white overflow-hidden ${i === 0 ? "border-b md:border-b-0 md:border-r border-[#e5e5e5]" : ""}`}
          >
            {/* Tile grande: cuadrado (≈50vw por lado en desktop, ancho completo en mobile) */}
            <div className="relative aspect-square bg-white">
              {/* Badge Urgencia / Escasez — mismo criterio que el carrusel */}
              {item.stock != null && item.stock > 0 && item.stock <= 3 && (
                <span className="absolute top-4 right-4 z-10 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded shadow-md animate-pulse">
                  Últimas {item.stock} u.
                </span>
              )}

              {item.img ? (
                <Image
                  src={item.img}
                  alt={`Anteojos de sol ${item.name} en Atelier Óptica Córdoba`}
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={`object-contain p-10 md:p-16 transition-all duration-700 ease-in-out md:group-hover:scale-[1.03] ${item.secondImg ? "md:group-hover:opacity-0" : ""}`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-[10px] font-black uppercase tracking-widest text-center">
                  Sin<br />Imagen
                </div>
              )}

              {item.secondImg && (
                <Image
                  src={item.secondImg}
                  alt={`${item.name} puesto`}
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover opacity-0 md:group-hover:opacity-100 transition-opacity duration-700 ease-in-out"
                />
              )}
            </div>

            {/* Ficha inferior — tipografía del resto del home */}
            <div className="px-5 py-6 flex items-end justify-between gap-4 border-t border-[#e5e5e5]">
              <div className="min-w-0">
                <h3 className="text-[15px] md:text-[17px] font-bold text-stone-900 uppercase tracking-wide line-clamp-1">
                  {item.name}
                </h3>
                {item.price && (
                  <p className="mt-1 text-[12px] font-medium text-stone-500">
                    {item.price}
                    <span className="ml-2 text-stone-400">· 15% off en efectivo o transferencia</span>
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] underline underline-offset-4 decoration-1 group-hover:opacity-60 transition-opacity whitespace-nowrap">
                Ver modelo →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
