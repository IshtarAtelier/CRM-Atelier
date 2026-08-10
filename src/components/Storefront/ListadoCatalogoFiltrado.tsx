"use client";

// ────────────────────────────────────────────────────────────────────────────
// Grilla de un listado de categoría (/lentes-de-sol, /receta) con los filtros
// de la URL aplicados EN EL CLIENTE.
//
// Por qué existe: las dos páginas leían `searchParams` en el servidor para armar
// el WHERE y el ORDER BY de Prisma. Leer searchParams vuelve DINÁMICA la ruta,
// así que su `export const revalidate = 300` era letra muerta: no había ISR y
// cada visita —incluida la del 99% que entra sin ningún filtro— pagaba las dos
// consultas del listado. Ahora la página trae siempre el listado completo (la
// vista por defecto, cacheable) y el recorte por marca/forma/material/género y
// el orden se hacen acá, sobre datos que ya viajaron.
//
// El lector de la URL va aparte y adentro de un <Suspense>: `useSearchParams()`
// hace que TODO lo que cuelgue del Suspense más cercano se renderice recién en
// el cliente. Si lo llamáramos en este componente, la grilla no saldría en el
// HTML estático y estas dos páginas viven de aparecer en Google. Aislado en un
// componente que devuelve null, el fallback y el HTML final son idénticos.
// (Mismo patrón que `FiltrosDesdeUrl` en src/app/tienda/TiendaClient.tsx.)
// ────────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CategoryGrid } from "./CategoryGrid";

export interface FiltrosListado {
  marca: string;
  forma: string;
  material: string;
  genero: string;
  orden: string;
}

const SIN_FILTROS: FiltrosListado = {
  marca: "",
  forma: "",
  material: "",
  genero: "",
  orden: "recientes",
};

function FiltrosDesdeUrl({ onChange }: { onChange: (filtros: FiltrosListado) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onChange({
      marca: searchParams.get("marca") || "",
      forma: searchParams.get("forma") || "",
      material: searchParams.get("material") || "",
      genero: searchParams.get("genero") || "",
      orden: searchParams.get("orden") || "recientes",
    });
  }, [searchParams, onChange]);

  return null;
}

/** ¿El género cargado en el producto entra en la solapa elegida? */
function coincideGenero(generoProducto: string | null | undefined, filtro: string): boolean {
  if (!generoProducto) return true;
  const g = generoProducto.toLowerCase();
  const esNeutro = g.includes("unisex") || g.includes("sin_genero") || g.includes("no_gender");
  switch (filtro.toLowerCase()) {
    case "femme":
      return g.includes("femenino") || g.includes("mujer") || g.includes("femme") || esNeutro;
    case "homme":
      return g.includes("masculino") || g.includes("hombre") || g.includes("homme") || esNeutro;
    case "no_gender":
      return esNeutro;
    default:
      return true;
  }
}

export function ListadoCatalogoFiltrado({
  productos,
  nombreCategoria,
  mensajeVacio,
  // Con `{marca}` donde va el nombre de la marca. Va como plantilla y no como
  // función porque los props de un client component tienen que ser serializables.
  plantillaVacioPorMarca,
}: {
  productos: any[];
  nombreCategoria: string;
  mensajeVacio: string;
  plantillaVacioPorMarca: string;
}) {
  const [filtros, setFiltros] = useState<FiltrosListado>(SIN_FILTROS);

  // Cuando el listado viene del fallback (memoria o snapshot) las filas no
  // traen la marca real: el filtro por marca se ignora en vez de vaciar la
  // grilla, igual que hacía la versión server-side mientras durara la falla.
  const hayMarcas = useMemo(() => productos.some((p) => p.marcaReal), [productos]);

  const visibles = useMemo(() => {
    let resultado = productos;

    if (filtros.marca && hayMarcas) {
      const buscada = filtros.marca.toLowerCase();
      resultado = resultado.filter((p) => (p.marcaReal || "").toLowerCase() === buscada);
    }
    if (filtros.forma) {
      const buscada = filtros.forma.toLowerCase();
      resultado = resultado.filter((p) =>
        (p.shape || "")
          .split(",")
          .map((s: string) => s.trim().toLowerCase())
          .includes(buscada),
      );
    }
    if (filtros.material) {
      const buscado = filtros.material.toLowerCase();
      resultado = resultado.filter((p) => (p.material || "").toLowerCase() === buscado);
    }
    if (filtros.genero) {
      resultado = resultado.filter((p) => coincideGenero(p.gender, filtros.genero));
    }

    // El orden que llega del servidor ya es [destacados, luego lo más nuevo]:
    // eso ES "recientes" y no hay que recalcularlo (createdAt ni siquiera viaja).
    // Los otros tres reordenan sobre una copia —`sort` muta— y respetan que los
    // destacados van primero, como el `orderBy` que hacía Prisma.
    if (filtros.orden === "menor_precio" || filtros.orden === "mayor_precio") {
      const signo = filtros.orden === "menor_precio" ? 1 : -1;
      resultado = [...resultado].sort(
        (a, b) =>
          Number(!!b.isFeatured) - Number(!!a.isFeatured) ||
          signo * ((a.price || 0) - (b.price || 0)),
      );
    } else if (filtros.orden === "forma") {
      resultado = [...resultado].sort((a, b) =>
        (a.shape || "").toLowerCase().localeCompare((b.shape || "").toLowerCase()),
      );
    }

    return resultado;
  }, [productos, filtros, hayMarcas]);

  return (
    <>
      <Suspense fallback={null}>
        <FiltrosDesdeUrl onChange={setFiltros} />
      </Suspense>
      <CategoryGrid
        products={visibles}
        categoryName={nombreCategoria}
        emptyMessage={
          filtros.marca
            ? plantillaVacioPorMarca.replace("{marca}", filtros.marca)
            : mensajeVacio
        }
      />
    </>
  );
}
