// ────────────────────────────────────────────────────────────────────────────
// Núcleo genérico de resiliencia de catálogo.
//
// Cualquier dato de catálogo que la web no puede dejar de mostrar se envuelve en
// un "resilient source" con cadena de fallback:
//
//     vivo (DB, con reintentos) → última lectura buena en memoria → snapshot del build
//
// Reglas:
//   · Una respuesta viva VACÍA se trata como falla (no se muestra una tienda
//     vacía habiendo datos buenos previos). El vacío legítimo de una búsqueda
//     filtrada NO pasa por acá: las queries parametrizadas viven en las páginas
//     y solo caen a su source ante ERROR (ver sources.ts).
//   · La memoria solo se actualiza con lecturas vivas con datos (no se envenena).
//   · El snapshot es el piso: garantiza que un proceso recién nacido sin DB
//     (build o boot) igual tiene productos.
//
// Módulo PURO y SIN imports a propósito: lo ejecutan también los checks con Node
// pelado (--experimental-strip-types), que no resuelve el alias "@/".
// ────────────────────────────────────────────────────────────────────────────

export type CatalogOrigin = "live" | "memory" | "snapshot";

export interface ResilientResult<T> {
  data: T;
  origin: CatalogOrigin;
}

export interface ResilientSourceConfig<T> {
  /** Nombre para logs y diagnóstico, p. ej. "home", "tienda-catalogo". */
  key: string;
  /** Lectura viva (query por defecto de la fuente). */
  fetcher: () => Promise<T>;
  /** Piso empaquetado en el build. */
  snapshot: T;
  /** Cuándo considerar "sin datos". Default: arrays u objetos-de-arrays vacíos. */
  isEmpty?: (value: T) => boolean;
  /** Intentos contra la DB antes de caer al fallback (default 3). */
  retries?: number;
  /** Base del backoff lineal entre intentos, en ms (default 500 → 500, 1000…). */
  backoffMs?: number;
}

export interface ResilientSource<T> {
  key: string;
  /** Nunca lanza y nunca devuelve vacío (si el snapshot tiene datos). */
  get(): Promise<ResilientResult<T>>;
}

/**
 * Vacío por defecto: [] para arrays; para objetos, vacío si TODAS sus propiedades
 * array están vacías (sirve para payloads compuestos {products, meta, count}).
 */
export function defaultIsEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const arrays = Object.values(value as Record<string, unknown>).filter(Array.isArray);
    if (arrays.length === 0) return false; // sin arrays no hay criterio → no vacío
    return arrays.every((a) => (a as unknown[]).length === 0);
  }
  return false;
}

async function fetchWithRetries<T>(
  key: string,
  fetcher: () => Promise<T>,
  retries: number,
  backoffMs: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return { ok: true, value: await fetcher() };
    } catch (error) {
      console.error(`[catalog:${key}] intento ${attempt}/${retries} falló:`, error);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
    }
  }
  return { ok: false };
}

export function createResilientSource<T>(config: ResilientSourceConfig<T>): ResilientSource<T> {
  const {
    key,
    fetcher,
    snapshot,
    isEmpty = defaultIsEmpty,
    retries = 3,
    backoffMs = 500,
  } = config;

  // Última lectura viva con datos. Vive lo que viva el proceso (sobrevive entre
  // renders/regeneraciones ISR; se pierde en un reinicio, donde entra el snapshot).
  let lastGood: T | null = null;

  return {
    key,
    async get(): Promise<ResilientResult<T>> {
      const live = await fetchWithRetries(key, fetcher, retries, backoffMs);

      if (live.ok && !isEmpty(live.value)) {
        lastGood = live.value;
        return { data: live.value, origin: "live" };
      }
      if (live.ok) {
        console.error(`[catalog:${key}] la DB respondió pero SIN datos — se usa el fallback.`);
      }
      if (lastGood !== null && !isEmpty(lastGood)) {
        console.error(`[catalog:${key}] sirviendo desde memoria (última lectura buena).`);
        return { data: lastGood, origin: "memory" };
      }
      console.error(`[catalog:${key}] sirviendo desde snapshot del build.`);
      return { data: snapshot, origin: "snapshot" };
    },
  };
}
