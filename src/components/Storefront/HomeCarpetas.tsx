import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

/**
 * "Carpetas" del home: tres puertas grandes, una por familia de la tienda
 * (Sol / Receta / Clip-on), cada una con una foto de la sesión de Agostina
 * ocupando todo el cuadro y una muestra de armazones reales de esa familia.
 * Va APARTE del carrusel giratorio, no lo reemplaza.
 *
 * PROTOTIPO — pedido de Ishtar del 16/9/2026: "que tenga más anteojos de la
 * tienda; una carpeta que diga Sol con una portada de Agostina, otra Clip-on…
 * imagen que ocupe todo; armalo solo en localhost y mostrame opciones".
 * Las tres variantes se eligen con `?carpetas=a|b|c` en el home. Cuando se
 * decida una, las otras dos se borran y el parámetro también.
 */

export interface CarpetaProducto {
  id: string | number;
  name: string;
  img: string;
  slug: string;
}

export interface Carpeta {
  key: "sol" | "receta" | "clipon";
  titulo: string;
  bajada: string;
  href: string;
  portada: string;
  /** Foto alternativa (3/4 o manos) para las variantes que usan dos. */
  portadaAlt?: string;
  /** Dónde está la cara en la portada, para que el recorte no la corte. */
  foco?: string;
  cantidad: number;
  productos: CarpetaProducto[];
  /** La portada es una foto de producto sobre blanco (no hay foto con modelo):
   *  se muestra entera, sobre fondo claro y con el texto en negro. */
  claro?: boolean;
}

export type VarianteCarpetas = "a" | "b" | "c";

interface Props {
  carpetas: Carpeta[];
  variante: VarianteCarpetas;
  totalCatalogo: number;
}

const Etiqueta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-black uppercase tracking-[0.3em]">{children}</span>
);

/** Miniatura de un armazón (foto de producto, fondo blanco) con su nombre. */
const Mini = ({ p, oscuro = false }: { p: CarpetaProducto; oscuro?: boolean }) => (
  <Link href={`/producto/${p.slug}`} className="group/mini block">
    <div className={`relative aspect-square overflow-hidden ${oscuro ? "bg-white/95" : "bg-stone-50"}`}>
      <Image src={p.img} alt={p.name} fill sizes="160px" className="object-contain p-2 transition-transform duration-500 group-hover/mini:scale-110" />
    </div>
    <p className={`mt-1.5 text-[10px] uppercase tracking-widest truncate ${oscuro ? "text-white/70" : "text-stone-600"}`}>{p.name}</p>
  </Link>
);

export function HomeCarpetas({ carpetas, variante, totalCatalogo }: Props) {
  if (variante === "b") return <VarianteEditorial carpetas={carpetas} />;
  if (variante === "c") return <VarianteMosaico carpetas={carpetas} totalCatalogo={totalCatalogo} />;
  return <VariantePuertas carpetas={carpetas} />;
}

/* ───────────────────────── A · TRES PUERTAS ─────────────────────────
   Tres columnas a toda altura, una por carpeta. La foto ocupa todo; al pasar
   el mouse sube una tira con cuatro armazones de esa familia. En celular
   las tres se apilan. Es la lectura más rápida: "elegí tu puerta". */
function VariantePuertas({ carpetas }: { carpetas: Carpeta[] }) {
  return (
    <section className="w-full bg-black" aria-label="Elegí tu colección">
      <div className="grid grid-cols-1 md:grid-cols-3">
        {carpetas.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="group relative block h-[72svh] md:h-[92svh] overflow-hidden border-b md:border-b-0 md:border-r border-white/10 last:border-0"
          >
            <Image
              src={c.portada}
              alt={`${c.titulo} — Atelier Óptica`}
              fill
              sizes="(max-width: 768px) 100vw, 34vw"
              className={`transition-transform duration-[1400ms] ease-out group-hover:scale-105 ${c.claro ? "object-contain p-10 pb-64 bg-white" : "object-cover"}`}
              style={{ objectPosition: c.foco ?? "center top" }}
            />
            {/* Las fotos de la sesión son claras: el velo tiene que ser firme
                abajo para que el texto blanco se lea, y desaparecer arriba. */}
            <div className={`absolute inset-0 ${c.claro ? "bg-gradient-to-t from-white via-white/60 via-35% to-transparent" : "bg-gradient-to-t from-black/90 via-black/60 via-45% to-transparent"}`} />

            <div className={`absolute inset-x-0 bottom-0 p-7 lg:p-10 ${c.claro ? "text-black" : "text-white"}`}>
              <Etiqueta>
                <span className={c.claro ? "text-[color:var(--dorado-texto)]" : "text-[color:var(--dorado)]"}>{c.cantidad} modelos</span>
              </Etiqueta>
              <h3 className="mt-2 text-5xl lg:text-7xl font-light tracking-tight leading-none">{c.titulo}</h3>
              <p className={`mt-3 text-sm max-w-xs ${c.claro ? "text-stone-600" : "text-white/75"}`}>{c.bajada}</p>

              {/* Tira de armazones reales de la familia, siempre a la vista */}
              <div className="mt-6 grid grid-cols-4 gap-2">
                {c.productos.slice(0, 4).map((p) => (
                  <div key={p.id} className={`relative aspect-square overflow-hidden ${c.claro ? "bg-stone-100" : "bg-white/95"}`}>
                    <Image src={p.img} alt={p.name} fill sizes="120px" className="object-contain p-1.5" />
                  </div>
                ))}
              </div>

              <span className={`mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] border-b pb-1 transition-colors ${c.claro ? "border-black/30 group-hover:border-black" : "border-white/40 group-hover:border-white"}`}>
                Ver {c.titulo.toLowerCase()} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── B · EDITORIAL ─────────────────────────
   Una franja por carpeta, a todo el ancho: la foto de Agostina de un lado y,
   del otro, un panel blanco con el título y SEIS armazones reales de esa
   familia. Alterna el lado de la foto. Es la que más anteojos muestra. */
function VarianteEditorial({ carpetas }: { carpetas: Carpeta[] }) {
  return (
    <section className="w-full bg-white" aria-label="Colecciones">
      {carpetas.map((c, i) => {
        const fotoDerecha = i % 2 === 1;
        return (
          <div key={c.key} className={`grid md:grid-cols-2 border-t border-stone-200 ${fotoDerecha ? "md:[&>*:first-child]:order-2" : ""}`}>
            <Link href={c.href} className="group relative block aspect-[4/5] md:aspect-auto md:min-h-[88svh] overflow-hidden bg-black">
              <Image
                src={c.key === "clipon" && c.portadaAlt ? c.portadaAlt : c.portada}
                alt={`${c.titulo} — Atelier Óptica`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={`transition-transform duration-[1400ms] ease-out group-hover:scale-105 ${c.claro ? "object-contain p-12 bg-stone-100" : "object-cover"}`}
                style={{ objectPosition: c.foco ?? "center top" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent md:hidden" />
              <div className="absolute bottom-6 left-6 text-white md:hidden">
                <h3 className="text-5xl font-light">{c.titulo}</h3>
              </div>
            </Link>

            <div className="flex flex-col justify-center px-6 py-12 md:px-14 lg:px-20">
              <Etiqueta>
                <span className="text-[color:var(--dorado-texto)]">Colección · {c.cantidad} modelos</span>
              </Etiqueta>
              <h3 className="hidden md:block mt-3 text-6xl lg:text-7xl font-light tracking-tight leading-none">{c.titulo}</h3>
              <p className="mt-4 text-[15px] text-stone-600 max-w-md leading-relaxed">{c.bajada}</p>

              <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-5 max-w-md">
                {c.productos.slice(0, 6).map((p) => <Mini key={p.id} p={p} />)}
              </div>

              <Link href={c.href} className="mt-9 inline-flex w-fit items-center gap-3 bg-black text-white px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] hover:bg-stone-800 transition-colors">
                Ver los {c.cantidad} modelos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ───────────────────────── C · MOSAICO ─────────────────────────
   Un solo bloque a pantalla: Sol grande a la izquierda (dos filas), Receta
   arriba a la derecha, y abajo Clip-on junto a una baldosa "todo el catálogo"
   con un collage de armazones. Compacto: no agrega scroll casi. */
function VarianteMosaico({ carpetas, totalCatalogo }: { carpetas: Carpeta[]; totalCatalogo: number }) {
  const [sol, receta, clipon] = carpetas;
  const collage = carpetas.flatMap((c) => c.productos.slice(0, 3)).slice(0, 9);

  const Baldosa = ({ c, sizes, alta = false, foco, className = "" }: { c: Carpeta; sizes: string; alta?: boolean; foco?: string; className?: string }) => (
    <Link href={c.href} className={`group relative block overflow-hidden ${c.claro ? "bg-stone-100" : "bg-black"} ${alta ? "min-h-[80svh] md:min-h-0" : "min-h-[48svh] md:min-h-0"} ${className}`}>
      <Image
        src={c.portada}
        alt={`${c.titulo} — Atelier Óptica`}
        fill
        sizes={sizes}
        className={`transition-transform duration-[1400ms] ease-out group-hover:scale-105 ${c.claro ? "object-contain p-6 pb-28" : "object-cover"}`}
        style={{ objectPosition: foco ?? c.foco ?? "center top" }}
      />
      <div className={`absolute inset-0 ${c.claro ? "bg-gradient-to-t from-white via-white/50 via-22% to-transparent" : "bg-gradient-to-t from-black/85 via-black/40 via-35% to-transparent"}`} />
      <div className={`absolute left-6 bottom-6 lg:left-8 lg:bottom-8 ${c.claro ? "text-black" : "text-white"}`}>
        <Etiqueta><span className={c.claro ? "text-[color:var(--dorado-texto)]" : "text-[color:var(--dorado)]"}>{c.cantidad} modelos</span></Etiqueta>
        <h3 className={`mt-1 font-light tracking-tight leading-none ${alta ? "text-6xl lg:text-8xl" : "text-4xl lg:text-5xl"}`}>{c.titulo}</h3>
      </div>
      {/* Tres armazones de la familia, arriba a la derecha para no pisar el título */}
      <div className="absolute right-5 top-5 lg:right-6 lg:top-6 flex gap-1.5">
        {c.productos.slice(0, 3).map((p) => (
          <div key={p.id} className="relative w-12 h-12 lg:w-16 lg:h-16 bg-white/95 overflow-hidden shadow-sm">
            <Image src={p.img} alt={p.name} fill sizes="64px" className="object-contain p-1" />
          </div>
        ))}
      </div>
    </Link>
  );

  return (
    <section className="w-full bg-black" aria-label="Colecciones">
      <div className="grid md:grid-cols-2 md:grid-rows-2 md:h-[96svh] gap-px bg-white/10">
        <Baldosa c={sol} sizes="(max-width: 768px) 100vw, 50vw" alta className="md:row-span-2" />
        <Baldosa c={receta} sizes="(max-width: 768px) 100vw, 50vw" foco="center 22%" />
        <div className="grid grid-cols-2 gap-px bg-white/10">
          <Baldosa c={clipon} sizes="(max-width: 768px) 50vw, 25vw" />
          <Link href="/tienda" className="group relative block bg-white min-h-[48svh] md:min-h-0 overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-3 gap-px p-3">
              {collage.map((p) => (
                <div key={p.id} className="relative bg-stone-50">
                  <Image src={p.img} alt={p.name} fill sizes="100px" className="object-contain p-1.5 opacity-90 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent pt-14 pb-5 px-5">
              <Etiqueta><span className="text-[color:var(--dorado-texto)]">Toda la tienda</span></Etiqueta>
              <p className="mt-1 text-2xl lg:text-3xl font-light leading-none">{totalCatalogo} modelos</p>
              <span className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em]">Ver todo <ArrowRight className="w-3.5 h-3.5" /></span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
