import { createHmac, timingSafeEqual } from 'crypto';
import { decrypt } from './auth';

/**
 * Llave de acceso al catálogo mayorista (/capsulaescarlata).
 *
 * El catálogo muestra precios netos B2B: NO puede quedar abierto a cualquiera
 * que llegue a la URL. Se entra de tres formas y ninguna es "entrar de una":
 *   1. `?r=` / `?lead=` — código del lead, que la página resuelve contra la DB.
 *   2. `?k=` — esta llave general, para mandar el link a mano (sin lead cargado).
 *   3. Sesión válida (equipo u óptica ya logueada).
 *
 * La llave se deriva del JWT_SECRET en vez de ser una variable propia: así no
 * hay que cargar nada nuevo en Railway y rota sola si algún día se rota el
 * secreto. WHOLESALE_CATALOG_KEY existe como escape hatch para invalidar todos
 * los links mandados sin tocar el JWT (cambiar ese valor = links viejos mueren).
 */
const KEY_PURPOSE = 'capsulaescarlata:v1';

export function catalogAccessKey(): string {
  const secret = process.env.WHOLESALE_CATALOG_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('WHOLESALE_CATALOG_KEY o JWT_SECRET son necesarios para firmar el link del catálogo mayorista.');
  }
  return createHmac('sha256', secret).update(KEY_PURPOSE).digest('hex').slice(0, 20);
}

export function isValidCatalogKey(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  let expected: string;
  try {
    expected = catalogAccessKey();
  } catch {
    // Sin secreto no hay llave válida posible: nunca abrir por las dudas.
    return false;
  }
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

/**
 * ¿Esta request puede VER precios netos? Solo con sesión válida: una óptica
 * dada de alta o alguien del equipo. Las rutas `/api/store/*` no pasan por la
 * validación del middleware (son públicas por diseño), así que las que sirven
 * precios mayoristas tienen que preguntar acá, a mano.
 */
export async function canSeeWholesalePrices(sessionToken: string | null | undefined): Promise<boolean> {
  if (!sessionToken) return false;
  return Boolean(await decrypt(sessionToken));
}

/** Link general del catálogo, listo para pegar en un WhatsApp. */
export function catalogShareUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/capsulaescarlata?k=${catalogAccessKey()}`;
}
