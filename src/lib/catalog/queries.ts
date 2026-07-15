// ────────────────────────────────────────────────────────────────────────────
// Registro ÚNICO de las queries de catálogo del storefront.
//
// Cada fuente resiliente (sources.ts) y el generador de snapshots
// (scripts/maintenance/refresh-catalog-snapshots.mjs) leen de acá: una sola
// definición de WHERE/SELECT/ORDER por fuente, imposible que driftée entre la
// página, el fallback y el snapshot.
//
// Los SELECT están recortados a los campos que consumen los mappers de cada
// página — nunca la fila completa de Product: menos peso y ningún dato interno
// (costos, proveedores) dentro de los JSON commiteados de src/data/snapshots/.
//
// Módulo PURO: el cliente de prisma se INYECTA (la app pasa el suyo; el script
// del build crea el propio). Cero imports para que Node pelado pueda cargarlo.
// ────────────────────────────────────────────────────────────────────────────

// Tipado estructural mínimo del cliente inyectado (evita depender de @prisma/client acá).
export interface CatalogPrismaClient {
  webProduct: {
    findMany(args: unknown): Promise<any[]>;
    count(args: unknown): Promise<number>;
  };
}

/** SELECT del carrusel del home (mantener en sync con formatProducts). */
export const HOME_SELECT = {
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

/** SELECT del catálogo de /tienda y /api/store/products (canal web). */
export const TIENDA_SELECT = {
  name: true,
  category: true,
  slug: true,
  images: true,
  isFeatured: true,
  product: {
    select: {
      id: true,
      brand: true,
      model: true,
      seoTags: true,
      price: true,
      salePrice: true,
      stock: true,
      imagenesCatalogo: true,
      gender: true,
    },
  },
} as const;

/** SELECT de los listados de /lentes-de-sol y /receta. */
export const LISTADO_SELECT = {
  name: true,
  category: true,
  slug: true,
  images: true,
  isFeatured: true,
  product: {
    select: {
      id: true,
      model: true,
      seoTags: true,
      price: true,
      stock: true,
      imagenesCatalogo: true,
      gender: true,
    },
  },
} as const;

/** SELECT de /arma-tus-lentes (usa imageUrl además de images). */
export const ARMA_SELECT = {
  name: true,
  imageUrl: true,
  category: true,
  slug: true,
  images: true,
  product: {
    select: {
      id: true,
      model: true,
      price: true,
      stock: true,
      imagenesCatalogo: true,
    },
  },
} as const;

/** WHERE base (sin filtros del usuario) de cada listado parametrizado. */
export const SOL_BASE_WHERE = {
  category: { contains: "Sol", mode: "insensitive" },
  isActive: true,
} as const;

export const RECETA_BASE_WHERE = {
  category: { contains: "Receta", mode: "insensitive" },
  isActive: true,
} as const;

/**
 * Queries por defecto de cada fuente. Devuelven exactamente lo que su página
 * consume cuando no hay filtros del usuario — y por lo tanto, exactamente lo
 * que se congela en su snapshot.
 */
export function catalogQueries(prisma: CatalogPrismaClient) {
  return {
    /** Colecciones del carrusel del home + total del catálogo. */
    async home() {
      const [destacados, sol, receta, nuevos, count] = await Promise.all([
        prisma.webProduct.findMany({
          where: {
            isActive: true,
            isFeatured: true, // solo destacados en el carrusel del home
            product: { publishToWeb: true, category: { not: "Cristal" } },
          },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24, // margen para la dedup de variantes
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: "Lentes de Sol" } },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: "Armazón de Receta" } },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { isActive: true, product: { publishToWeb: true, category: { not: "Cristal" } } },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.count({
          where: { isActive: true, product: { publishToWeb: true, category: { not: "Cristal" } } },
        }),
      ]);
      return { destacados, sol, receta, nuevos, count };
    },

    /** Metadatos del sidebar de filtros de /tienda (marcas/formas/materiales). */
    async tiendaFiltros() {
      return prisma.webProduct.findMany({
        where: {
          isActive: true,
          product: { publishToWeb: true, category: { not: "Cristal" } },
        },
        select: {
          name: true,
          product: { select: { brand: true, model: true, seoTags: true } },
        },
      });
    },

    /** Catálogo web completo (filas crudas) de /tienda y /api/store/products. */
    async tiendaCatalogo() {
      return prisma.webProduct.findMany({
        where: {
          isActive: true,
          product: { publishToWeb: true, category: { not: "Cristal" } },
        },
        select: TIENDA_SELECT,
        // Destacados primero, luego lo más nuevo: la vitrina abre por lo curado.
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      });
    },

    /** /lentes-de-sol sin filtros: productos (orden default) + filas para marcas/formas. */
    async sol() {
      const [products, meta] = await Promise.all([
        prisma.webProduct.findMany({
          where: SOL_BASE_WHERE,
          select: LISTADO_SELECT,
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        }),
        prisma.webProduct.findMany({
          where: SOL_BASE_WHERE,
          select: { name: true, product: { select: { brand: true, model: true } } },
        }),
      ]);
      return { products, meta };
    },

    /** /receta sin filtros: ídem sol. */
    async receta() {
      const [products, meta] = await Promise.all([
        prisma.webProduct.findMany({
          where: RECETA_BASE_WHERE,
          select: LISTADO_SELECT,
          orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        }),
        prisma.webProduct.findMany({
          where: RECETA_BASE_WHERE,
          select: { name: true, product: { select: { brand: true, model: true } } },
        }),
      ]);
      return { products, meta };
    },

    /** /arma-tus-lentes: armazones de receta con stock. */
    async armaTusLentes() {
      return prisma.webProduct.findMany({
        where: {
          category: { contains: "Receta", mode: "insensitive" },
          isActive: true,
          product: { stock: { gt: 0 } },
        },
        select: ARMA_SELECT,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      });
    },
  };
}

/** Claves de fuente registradas — el generador y los checks recorren esta lista. */
export const CATALOG_SOURCE_KEYS = [
  "home",
  "tienda-filtros",
  "tienda-catalogo",
  "sol",
  "receta",
  "arma-tus-lentes",
] as const;

export type CatalogSourceKey = (typeof CATALOG_SOURCE_KEYS)[number];

/** Mapa clave → método de catalogQueries (para iterar programáticamente). */
export function runCatalogQuery(prisma: CatalogPrismaClient, key: CatalogSourceKey): Promise<unknown> {
  const q = catalogQueries(prisma);
  switch (key) {
    case "home": return q.home();
    case "tienda-filtros": return q.tiendaFiltros();
    case "tienda-catalogo": return q.tiendaCatalogo();
    case "sol": return q.sol();
    case "receta": return q.receta();
    case "arma-tus-lentes": return q.armaTusLentes();
  }
}
