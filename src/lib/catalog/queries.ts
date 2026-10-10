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
      // 7/9/26: sin `salePrice` el carrusel del home no podía saber si un
      // producto estaba REBAJADO, así que una oferta real era invisible
      // justo en la pantalla que más gente ve. Mismo agujero que tenía
      // /clip-on.
      salePrice: true,
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
  // El alt de la foto es la única fuente del COLOR del armazón: el catálogo no
  // tiene columna para eso, y los alts se escribieron con estructura fija
  // ("… negro, en acetato, forma cat-eye …"). Merchant Center pide `color` para
  // la categoría Gafas. Ver src/lib/catalog/frame-specs.ts.
  imageAlts: true,
  isFeatured: true,
  // La descripción de la ficha. La lee SOLO el mapeo, para saber si el lente es
  // polarizado (ver esPolarizado en tienda-map.ts); el texto no viaja a la grilla.
  description: true,
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
      // mpn / ageGroup / seoDescription no los usa la grilla: los necesita el
      // feed de Google y Meta, que se arma sobre este mismo catálogo cacheado.
      mpn: true,
      ageGroup: true,
      seoDescription: true,
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
      // Sin `salePrice`, /receta, /lentes-de-sol y /clip-on mostraban el precio
      // de LISTA para un producto rebajado, y sin el cartel de oferta:
      // `CategoryGrid` sabe resolver la oferta pero nunca la recibía. Un Rigel
      // rebajado de $215.000 a $160.000 se anunciaba a $182.750 ahí y a
      // $136.000 en /tienda (auditoría 8/9/26).
      salePrice: true,
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
      // Sin la oferta, el builder sumaba el armazón a precio de LISTA mientras
      // la tienda y el checkout usaban la rebajada: Orión C1 se presupuestaba a
      // $215.000 y se cobraba $180.000 (auditoría 25/9/26).
      salePrice: true,
      stock: true,
      imagenesCatalogo: true,
    },
  },
} as const;

/**
 * QUÉ SE VE EN LA TIENDA — la regla ÚNICA. Todo lo público la usa: home,
 * /tienda, /receta, /lentes-de-sol, /arma-tus-lentes, sus respaldos, el
 * sitemap, la API de la tienda y la ficha.
 *
 * Estaba escrita a mano en ~20 `where` y ya había divergido: el home no
 * excluía cristales en Sol/Receta, /receta y /lentes-de-sol no miraban
 * `publishToWeb`, el respaldo de /receta no filtraba stock (traía un Xperio
 * de $913.780 sin stock que la página en vivo sí excluía, 10/10/2026), y la
 * ficha abría CUALQUIER producto del CRM por su id —cristales, costos de
 * laboratorio, los 834 sin publicar— con precio y botón de compra.
 *
 * Nunca va en la vidriera: un cristal (un Essilor de $280.000 llegó a listarse
 * en /receta), lo que no tiene stock (regla 19/8) ni lo desmarcado.
 */
export const PRODUCTO_EN_TIENDA = {
  publishToWeb: true,
  stock: { gt: 0 },
  category: { not: "Cristal" },
} as const;

/** Ficha web que aparece en los listados públicos. */
export const FICHA_EN_TIENDA = {
  isActive: true,
  product: PRODUCTO_EN_TIENDA,
} as const;

/**
 * Ficha que se puede ABRIR por su dirección: la de los listados, pero también
 * agotada (la ficha decide qué mostrar sin stock). Nunca un cristal ni algo
 * desmarcado. Hoy el sync apaga `isActive` sin stock, así que en la práctica
 * coincide con FICHA_EN_TIENDA; la diferencia es a propósito, para que la
 * ficha no dependa de ese detalle del sync.
 */
export const FICHA_PUBLICADA = {
  isActive: true,
  product: { publishToWeb: true, category: { not: "Cristal" } },
} as const;

/**
 * Lo que se vende a las ópticas (canal mayorista): las fichas PUBLICADAS que
 * además tienen el tilde mayorista. El catálogo mayorista lo lista, la ficha
 * lo abre y el checkout lo cobra con la MISMA regla. Antes el catálogo listaba
 * cualquier `publishToWholesale` aunque no tuviera ficha publicada, y ese link
 * daba 404 (revisión del 10/10/2026). Al 10/10 las 156 fichas mayoristas
 * también estaban publicadas: no cambia nada visible, cierra la divergencia.
 */
export const FICHA_MAYORISTA = {
  ...FICHA_PUBLICADA,
  product: { ...FICHA_PUBLICADA.product, publishToWholesale: true },
} as const;

/**
 * La misma regla para un producto YA leído: el checkout la aplica a cada ítem
 * del carrito y el carrito la usa para ponerse al día. Hasta el 10/10/2026 el
 * checkout aceptaba cualquier id que existiera en la base, así que un carrito
 * guardado (o armado a mano) compraba un armazón que la tienda ya había
 * despublicado u ocultado en /admin/web, o un cristal del CRM a su precio.
 * Es FICHA_PUBLICADA sobre la fila: ficha activa, publicado y no cristal (el
 * stock NO se mira acá: el checkout lo valida aparte, con su propio mensaje).
 * Una óptica compra lo mismo: todo lo mayorista es parte de lo publicado.
 */
export function sePuedeVenderEnLaWeb(p: {
  publishToWeb?: boolean | null;
  category?: string | null;
  webProducts?: { isActive: boolean | null }[] | null;
}): boolean {
  if (p.category === FICHA_PUBLICADA.product.category.not) return false;
  if (p.publishToWeb !== FICHA_PUBLICADA.product.publishToWeb) return false;
  return (p.webProducts ?? []).some((w) => w.isActive === FICHA_PUBLICADA.isActive);
}

/**
 * La dirección de la ficha de un producto, SOLO si se puede abrir (la misma
 * regla que sePuedeVenderEnLaWeb). El bot de WhatsApp pone este link al pie de
 * las fotos: armado con cualquier ficha, mandaba a la persona a un 404 en
 * medio del chat (revisión del 10/10/2026).
 */
export function slugDeFichaPublicada(p: {
  publishToWeb?: boolean | null;
  category?: string | null;
  webProducts?: { slug?: string | null; isActive: boolean | null }[] | null;
}): string | null {
  if (!sePuedeVenderEnLaWeb(p)) return null;
  return (p.webProducts ?? []).find((w) => w.isActive === FICHA_PUBLICADA.isActive && w.slug)?.slug ?? null;
}

/** WHERE base (sin filtros del usuario) de cada listado parametrizado. */
export const SOL_BASE_WHERE = {
  ...FICHA_EN_TIENDA,
  category: { contains: "Sol", mode: "insensitive" },
} as const;

export const RECETA_BASE_WHERE = {
  ...FICHA_EN_TIENDA,
  category: { contains: "Receta", mode: "insensitive" },
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
      // OJO: Product.category mete clip-ons y sol juntos bajo "Lentes de Sol".
      // La distinción real está en WebProduct.category ("Clip-On" vs "Sol"), que
      // es la que usa el admin — filtrar por la del Product mezcla las dos solapas.
      // Los CONTEOS por categoría van en el mismo Promise.all: son counts
      // indexados y corren en paralelo con las listas, así que no agregan una
      // vuelta más. Hacen falta porque las listas vienen con `take: 24` y
      // además pasan por la dedup de variantes — su `.length` NO es el total
      // real de la categoría (Receta tiene 91 y la lista trae 24).
      const [destacados, clipon, sol, receta, nuevos, count,
             countClipon, countSol, countReceta] = await Promise.all([
        prisma.webProduct.findMany({
          where: { ...FICHA_EN_TIENDA, isFeatured: true }, // solo destacados en el carrusel del home
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24, // margen para la dedup de variantes
        }),
        prisma.webProduct.findMany({
          where: { ...FICHA_EN_TIENDA, category: "Clip-On" },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { ...FICHA_EN_TIENDA, category: "Sol" },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: { ...FICHA_EN_TIENDA, category: "Receta" },
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.findMany({
          where: FICHA_EN_TIENDA,
          select: HOME_SELECT,
          orderBy: { createdAt: "desc" },
          take: 24,
        }),
        prisma.webProduct.count({
          where: FICHA_EN_TIENDA,
        }),
        prisma.webProduct.count({
          where: { ...FICHA_EN_TIENDA, category: "Clip-On" },
        }),
        prisma.webProduct.count({
          where: { ...FICHA_EN_TIENDA, category: "Sol" },
        }),
        prisma.webProduct.count({
          where: { ...FICHA_EN_TIENDA, category: "Receta" },
        }),
      ]);
      return {
        destacados, clipon, sol, receta, nuevos, count,
        conteos: { clipon: countClipon, sol: countSol, receta: countReceta },
      };
    },

    /** Metadatos del sidebar de filtros de /tienda (marcas/formas/materiales). */
    async tiendaFiltros() {
      return prisma.webProduct.findMany({
        where: FICHA_EN_TIENDA,
        select: {
          name: true,
          product: { select: { brand: true, model: true, seoTags: true } },
        },
      });
    },

    /** Catálogo web completo (filas crudas) de /tienda y /api/store/products. */
    async tiendaCatalogo() {
      return prisma.webProduct.findMany({
        where: FICHA_EN_TIENDA,
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
        where: RECETA_BASE_WHERE,
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
