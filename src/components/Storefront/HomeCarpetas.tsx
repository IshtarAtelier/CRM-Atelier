import Link from "next/link";
import Image from "next/image";

/**
 * Carpetas del home: un mosaico con cuatro fotos de la sesión de Agostina,
 * una por familia de la tienda, después del carrusel de "Lo nuevo de Atelier".
 * Receta grande a la izquierda (dos filas); a la derecha, arriba "Toda la
 * tienda" y abajo Clip-on y Sol. Sin miniaturas: las cuatro baldosas son
 * iguales entre sí. Elegido por Ishtar el 16/9/2026 entre tres variantes.
 *
 * Las portadas viven en public/images/home/carpetas y se generan con
 * scripts/maintenance/home-carpetas/generar-portadas.mjs (recorte desde el
 * tope de la cabeza, luz normalizada). Para cambiar una foto se regenera ahí.
 */

export interface Carpeta {
  key: "receta" | "tienda" | "clipon" | "sol";
  titulo: string;
  href: string;
  portada: string;
  /** Punto de la foto que no se puede recortar (la cara). */
  foco?: string;
  /** Conteo real de la categoría; sin dato no se muestra número. */
  cantidad?: number;
}

const Baldosa = ({ c, sizes, alta = false, className = "" }: { c: Carpeta; sizes: string; alta?: boolean; className?: string }) => (
  <Link href={c.href} className={`group relative block overflow-hidden bg-black ${alta ? "min-h-[80svh] md:min-h-0" : "min-h-[48svh] md:min-h-0"} ${className}`}>
    <Image
      src={c.portada}
      alt={`${c.titulo} — Atelier Óptica`}
      fill
      sizes={sizes}
      className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
      style={{ objectPosition: c.foco ?? "center top" }}
    />
    {/* Las fotos son claras: el velo firme abajo es lo que hace legible el texto blanco. */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 via-35% to-transparent" />
    <div className="absolute left-6 bottom-6 lg:left-8 lg:bottom-8 text-white">
      {c.cantidad ? <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--dorado)]">{c.cantidad} modelos</span> : null}
      <h3 className={`mt-1 font-light tracking-tight leading-none ${alta ? "text-6xl lg:text-8xl" : "text-4xl lg:text-5xl"}`}>{c.titulo}</h3>
    </div>
  </Link>
);

export function HomeCarpetas({ carpetas }: { carpetas: Carpeta[] }) {
  const por = (k: Carpeta["key"]) => carpetas.find((c) => c.key === k);
  const receta = por("receta"), tienda = por("tienda"), clipon = por("clipon"), sol = por("sol");
  if (!receta || !tienda || !clipon || !sol) return null;

  return (
    <section className="w-full bg-black" aria-label="Colecciones">
      <div className="grid md:grid-cols-2 md:grid-rows-2 md:h-[96svh] gap-px bg-white/10">
        <Baldosa c={receta} sizes="(max-width: 768px) 100vw, 50vw" alta className="md:row-span-2" />
        <Baldosa c={tienda} sizes="(max-width: 768px) 100vw, 50vw" />
        <div className="grid grid-cols-2 gap-px bg-white/10">
          <Baldosa c={clipon} sizes="(max-width: 768px) 50vw, 25vw" />
          <Baldosa c={sol} sizes="(max-width: 768px) 50vw, 25vw" />
        </div>
      </div>
    </section>
  );
}
