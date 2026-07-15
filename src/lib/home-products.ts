// ────────────────────────────────────────────────────────────────────────────
// Productos del home con fallback en cadena: vivo (DB) → memoria → snapshot.
//
// Reemplaza el patrón anterior (rethrowUnlessBuild) que tenía un agujero: si el
// build corría sin DB, la home se horneaba VACÍA y esa versión vacía quedaba
// cacheada como "última buena". Con esta capa la home siempre recibe productos:
//   1. la DB, si responde y trae productos;
//   2. la última lectura buena de este proceso, si la DB falla en runtime;
//   3. el snapshot generado en el build (scripts/maintenance/refresh-home-snapshot.mjs)
//      y commiteado en src/data/home-snapshot.json como último recurso.
// Una respuesta de DB con 0 productos se trata como falla (no pisa nada).
// ────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import snapshotJson from "@/data/home-snapshot.json";
import {
  chooseHomeSource,
  hasProducts,
  type HomeDataSource,
  type HomeSourceData,
} from "@/lib/home-fallback";

const SNAPSHOT = snapshotJson as unknown as HomeSourceData;

// Última lectura buena del proceso (sobrevive entre regeneraciones ISR).
let lastGood: HomeSourceData | null = null;

// Solo los campos que usa formatProducts (evita traer la fila completa del
// producto → HTML más liviano). Mantener en sync con refresh-home-snapshot.mjs.
const PRODUCT_SELECT = {
  name: true,
  imageUrl: true,
  images: true,
  slug: true,
  product: {
    select: {
      id: true,
      price: true,
      stock: true,
      model: true,
      category: true,
      imagenesCatalogo: true,
    },
  },
} as const;

const MAX_RETRIES = 3;

async function fetchLive(): Promise<HomeSourceData | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [destacados, sol, receta, nuevos, count] = await Promise.all([
        prisma.webProduct.findMany({
          where: {
            isActive: true,
            isFeatured: true, // Only display featured products in the homepage carousel
            product: { publishToWeb: true, category: { not: "Cristal" } },
          },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24, // Fetch more to allow for deduplication
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: "Lentes de Sol" } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: "Armazón de Receta" } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: { not: "Cristal" } } },
          select: PRODUCT_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.count({
          where: { isActive: true, product: { publishToWeb: true, category: { not: "Cristal" } } },
        }),
      ]);
      return { destacados, sol, receta, nuevos, count } as HomeSourceData;
    } catch (error) {
      console.error(`[Home] DB query attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // Backoff: 500ms, 1s
      }
    }
  }
  return null;
}

/**
 * Devuelve los datos del carrusel del home. NUNCA lanza y NUNCA devuelve vacío
 * (el snapshot empaquetado garantiza el piso). `source` indica de dónde salió.
 */
export async function getHomeProducts(): Promise<{ data: HomeSourceData; source: HomeDataSource }> {
  const live = await fetchLive();
  if (live && !hasProducts(live)) {
    console.error("[Home] La DB respondió pero con 0 productos — se usa el fallback.");
  }
  const chosen = chooseHomeSource(live, lastGood, SNAPSHOT);
  if (chosen.source === "live") {
    lastGood = chosen.data;
  } else {
    console.error(`[Home] Sirviendo productos desde fallback: ${chosen.source}`);
  }
  return chosen;
}
