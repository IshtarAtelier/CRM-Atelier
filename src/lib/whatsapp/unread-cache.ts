import { serverCache } from '@/lib/cache';

/**
 * Clave del contador global de no leídos del buzón.
 *
 * `GET /api/whatsapp/chats/unread-count` cachea ese número 20 s (es un `_sum`
 * sobre toda la tabla, sin índice). El efecto secundario: al marcar un chat como
 * leído, el badge volvía a subir hasta que el cache vencía. Por eso quien baje
 * el `unreadCount` de un chat invalida acá.
 */
export const CLAVE_CACHE_NO_LEIDOS = 'whatsapp-unread-count';

/** Tira el contador cacheado para que el próximo pedido lo recalcule. */
export function invalidarContadorNoLeidos(): void {
    serverCache.delete(CLAVE_CACHE_NO_LEIDOS);
}
