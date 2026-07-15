// ────────────────────────────────────────────────────────────────────────────
// Fuentes resilientes de catálogo del storefront (wiring de servidor).
//
// Acá se enchufa cada página pública: queries del registro (queries.ts) +
// snapshot del build (src/data/snapshots/) + núcleo genérico (resilience.ts).
// Agregar una página nueva = 1 query en queries.ts + 1 source acá + su clave en
// CATALOG_SOURCE_KEYS; el snapshot, el fallback y los checks salen gratis.
//
// Contrato para las páginas:
//   · Listados sin parámetros (home, tienda, arma-tus-lentes): llamar al getter
//     y usar `data` — nunca lanza, nunca llega vacío.
//   · Listados parametrizados (sol, receta): la página ejecuta su query filtrada
//     y SOLO ante error cae al getter (un resultado vacío por filtros es legítimo
//     y se muestra como "sin resultados").
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { createResilientSource } from "@/lib/catalog/resilience";
import { catalogQueries } from "@/lib/catalog/queries";
import { hasProducts, type HomeSourceData } from "@/lib/home-fallback";

import homeSnap from "@/data/snapshots/home.json";
import tiendaFiltrosSnap from "@/data/snapshots/tienda-filtros.json";
import tiendaCatalogoSnap from "@/data/snapshots/tienda-catalogo.json";
import solSnap from "@/data/snapshots/sol.json";
import recetaSnap from "@/data/snapshots/receta.json";
import armaSnap from "@/data/snapshots/arma-tus-lentes.json";

const queries = catalogQueries(prisma);

// Filas crudas tal como las devuelven las queries (las páginas las mapean).
export type CatalogRow = any;
export interface ListadoData {
  products: CatalogRow[];
  meta: CatalogRow[];
}

// ── home ──
const homeSource = createResilientSource<HomeSourceData>({
  key: "home",
  fetcher: () => queries.home() as Promise<HomeSourceData>,
  snapshot: homeSnap.data as unknown as HomeSourceData,
  isEmpty: (d) => !hasProducts(d),
});

/** Carrusel del home. Nunca lanza, nunca vacío. */
export const getHomeProducts = () => homeSource.get();

// ── /tienda ──
const tiendaFiltrosSource = createResilientSource<CatalogRow[]>({
  key: "tienda-filtros",
  fetcher: () => queries.tiendaFiltros(),
  snapshot: tiendaFiltrosSnap.data as CatalogRow[],
});

const tiendaCatalogoSource = createResilientSource<CatalogRow[]>({
  key: "tienda-catalogo",
  fetcher: () => queries.tiendaCatalogo(),
  snapshot: tiendaCatalogoSnap.data as CatalogRow[],
});

/** Filas para el sidebar de filtros de /tienda. */
export const getTiendaFiltros = () => tiendaFiltrosSource.get();
/** Catálogo web completo (crudo) para /tienda y /api/store/products. */
export const getTiendaCatalogo = () => tiendaCatalogoSource.get();

// ── /lentes-de-sol y /receta (parametrizadas: fallback SOLO ante error) ──
const solSource = createResilientSource<ListadoData>({
  key: "sol",
  fetcher: () => queries.sol(),
  snapshot: solSnap.data as ListadoData,
  isEmpty: (d) => (d?.products?.length || 0) === 0,
});

const recetaSource = createResilientSource<ListadoData>({
  key: "receta",
  fetcher: () => queries.receta(),
  snapshot: recetaSnap.data as ListadoData,
  isEmpty: (d) => (d?.products?.length || 0) === 0,
});

/** Vista por defecto de /lentes-de-sol (fallback de la query filtrada). */
export const getSolListado = () => solSource.get();
/** Vista por defecto de /receta (fallback de la query filtrada). */
export const getRecetaListado = () => recetaSource.get();

// ── /arma-tus-lentes ──
const armaSource = createResilientSource<CatalogRow[]>({
  key: "arma-tus-lentes",
  fetcher: () => queries.armaTusLentes(),
  snapshot: armaSnap.data as CatalogRow[],
  retries: 2, // página force-dynamic: no hacer esperar de más a un request caído
});

/** Armazones con stock para el builder. */
export const getArmaTusLentes = () => armaSource.get();
