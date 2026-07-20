/**
 * Revalidación de sesión contra la DB.
 *
 * El JWT dura 24h y el middleware solo valida su firma: un usuario borrado o con
 * rol degradado seguía operando hasta que expiraba (gap conocido del audit).
 * El middleware corre en Edge (sin Prisma), así que la revalidación no puede ir
 * ahí — se hace acá, del lado de las rutas (Node), con un caché corto en memoria
 * para no pegarle a la DB en cada request.
 *
 * Adopción: usar `getActorValidated(request)` en rutas sensibles (mutaciones de
 * admin, borrados, dinero). El objetivo es ir migrando las rutas críticas; las
 * demás siguen con `getActor` síncrono.
 */
import { prisma } from '@/lib/db';
import { getActor, type Actor } from '@/lib/actor';

const CACHE_TTL_MS = 60_000;
type CacheEntry = { role: string | null; exists: boolean; at: number };
const cache = new Map<string, CacheEntry>();

export interface ValidatedActor extends Actor {
  /** true si el usuario existe en la DB (o si es acción de sistema sin id). */
  valid: boolean;
  /** rol vigente en la DB (puede diferir del que trae el JWT si fue degradado). */
  dbRole: string | null;
}

/**
 * Revalida un usuario contra la DB (existe + rol vigente), con caché de 60s.
 * No lanza. Para acciones sin humano (id null) devuelve valid=true.
 */
export async function revalidateUser(userId: string | null): Promise<{ exists: boolean; role: string | null }> {
  if (!userId) return { exists: true, role: null };
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return { exists: cached.exists, role: cached.role };
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const entry: CacheEntry = { exists: !!user, role: user?.role ?? null, at: now };
    cache.set(userId, entry);
    return { exists: entry.exists, role: entry.role };
  } catch {
    // Ante error de DB, no bloquear (fail-open): mejor no tirar la app por la
    // revalidación. La firma del JWT ya fue validada por el middleware.
    return { exists: true, role: cached?.role ?? null };
  }
}

/**
 * Como getActor, pero además revalida contra la DB. El `role` devuelto es el
 * vigente en la DB (no el del token), y `valid` es false si el usuario ya no existe.
 */
export async function getActorValidated(request: Request, fallbackName = 'Sistema'): Promise<ValidatedActor> {
  const actor = getActor(request, fallbackName);
  const { exists, role } = await revalidateUser(actor.id);
  return {
    ...actor,
    role: actor.id ? role : actor.role, // rol vigente de la DB para usuarios reales
    valid: exists,
    dbRole: role,
  };
}

/** Invalida el caché de un usuario (llamar al degradar rol o borrar usuario). */
export function invalidateUserSessionCache(userId: string) {
  cache.delete(userId);
}
