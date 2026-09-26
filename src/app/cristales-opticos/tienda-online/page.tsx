import { Metadata } from "next";
import Link from "next/link";
import { CristalHero } from "@/components/cristales/CristalHero";
import { mapaOpcionesPublico } from "@/services/cristales-web.service";
import { opcionesDelGrupo, type GrupoCristal, type MapaOpciones } from "@/lib/cristales-web/claves";
import { INFORMACION_OPCIONES } from "@/lib/cristales-web/informacion";
import { precioConSigno } from "@/lib/format-precio";
import { rethrowUnlessBuild } from "@/lib/db-guard";

/**
 * Los cristales que se pueden comprar online en "Arma tus lentes", con su
 * explicación y su precio. El precio y el título salen del MISMO lugar que el
 * configurador y el checkout (WebLensOption + el producto vinculado): lo que se
 * lee acá es lo que se cobra. Una opción no disponible no se muestra.
 *
 * ISR de 1 minuto. El build de Railway no tiene base, así que la versión del
 * build sale sin precios; con 60 s se reemplaza enseguida por la buena (con 300
 * quedaba cinco minutos diciendo "Consultá los precios" después de cada deploy).
 * Si la base falla en runtime, `rethrowUnlessBuild` lanza y Next conserva la
 * última versión con precios en vez de cachear una vacía. Nunca un precio
 * inventado.
 */
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/cristales-opticos/tienda-online" },
  title: "Cristales para comprar online, con precio",
  description:
    "Todos los cristales que podés elegir en Arma tus lentes: monofocales, bifocal, multifocales y teñidos de sol, con qué incluye cada uno, para quién es y su precio. Atelier Óptica, Córdoba.",
};

const GRUPOS: { grupo: GrupoCristal; titulo: string; bajada: string }[] = [
  { grupo: "MONOFOCAL", titulo: "Monofocales", bajada: "Para ver a una sola distancia: lejos o cerca." },
  { grupo: "MULTIFOCAL", titulo: "Multifocales", bajada: "Lejos, intermedia y cerca en el mismo cristal, sin línea." },
  { grupo: "BIFOCAL", titulo: "Bifocal", bajada: "Dos zonas separadas por una línea visible." },
  { grupo: "TENIDO", titulo: "Teñidos para anteojos de sol", bajada: "Se suman al cristal para convertir cualquier armazón en un anteojo de sol." },
];

export default async function CristalesTiendaOnlinePage() {
  let opciones: MapaOpciones = {};
  try {
    opciones = await mapaOpcionesPublico();
  } catch (err) {
    rethrowUnlessBuild(err, "cristales/tienda-online");
  }
  const hayPrecios = Object.keys(opciones).length > 0;

  return (
    <div className="bg-[#faf8f5]">
      <CristalHero
        preTitle="Comprá online"
        title="Los cristales de Arma tus lentes"
        description={
          <>
            Estos son los cristales que podés elegir en la tienda, con lo que incluye cada uno y su precio. Los precios
            son del <strong>par de cristales</strong>, sin el armazón, y son los mismos que vas a ver al armarlos.
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-6 pb-20 space-y-16">
        {GRUPOS.map(({ grupo, titulo, bajada }) => {
          const lista = opcionesDelGrupo(opciones, grupo).filter((o) => o.disponible);
          if (hayPrecios && lista.length === 0) return null;
          return (
            <section key={grupo}>
              <h2 className="text-3xl font-bold mb-2">{titulo}</h2>
              <p className="text-stone-700 mb-8">{bajada}</p>
              {!hayPrecios && (
                <p className="text-stone-700">Consultá los precios en <Link href="/arma-tus-lentes" className="underline font-bold">Arma tus lentes</Link>.</p>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                {lista.map((o) => {
                  const info = INFORMACION_OPCIONES[o.clave];
                  return (
                    <article key={o.clave} className="relative bg-white border border-[#e8e2db] rounded-2xl p-6 flex flex-col">
                      {o.badge && (
                        <span className="absolute -top-3 left-6 bg-[var(--dorado-solido)] text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                          {o.badge}
                        </span>
                      )}
                      <h3 className="text-xl font-bold mb-1">{o.etiqueta}</h3>
                      {o.descripcion && <p className="text-stone-700 italic mb-3">{o.descripcion}</p>}
                      {info && <p className="text-stone-800 leading-relaxed mb-3">{info.queEs}</p>}
                      {o.destacados.length > 0 && (
                        <ul className="text-sm text-stone-700 space-y-1 mb-3">
                          {o.destacados.map((d) => (<li key={d}>✓ {d}</li>))}
                        </ul>
                      )}
                      {info && <p className="text-sm text-stone-700 mb-4"><strong>Para quién:</strong> {info.paraQuien}</p>}
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4 border-t border-[#e8e2db]">
                        <div>
                          <p className="text-2xl font-black">{precioConSigno(o.precio)}</p>
                          <p className="text-xs text-stone-600">{grupo === "TENIDO" ? "el teñido de un anteojo" : "el par de cristales"}{o.is2x1 ? " · incluye el 2º par (2x1)" : ""}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Link href="/arma-tus-lentes" className="bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-full hover:bg-stone-800">
                            Armar con este cristal
                          </Link>
                          {info?.masInfo && (
                            <Link href={info.masInfo.href} className="text-xs font-bold underline text-stone-700 py-2">
                              {info.masInfo.texto}
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="bg-white border border-[#e8e2db] rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">¿Buscás otro cristal?</h2>
          <p className="text-stone-700">
            En el local trabajamos muchos más: Varilux de toda la gama, Eyezen, Crizal, Xperio, control de miopía
            infantil con <Link href="/cristales-opticos/stellest" className="underline font-bold">Stellest</Link> y{" "}
            <Link href="/cristales-opticos/myofix" className="underline font-bold">MyoFix</Link>, y{" "}
            <Link href="/cristales-opticos/myolens" className="underline font-bold">MyoLens</Link> para miopes. Mandanos tu receta y te
            cotizamos.
          </p>
        </section>
      </div>
    </div>
  );
}
