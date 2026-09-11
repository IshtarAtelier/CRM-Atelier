import { PREFIJO_ARCHIVADO } from '@/lib/constants/catalogo';

/**
 * QUÉ SE PUEDE VENDER. La única definición de "producto archivado".
 *
 * Hasta el 11/9/2026 la regla vivía en dos lugares con dos strings distintos —
 * una regex tolerante en el cotizador y un `startsWith` sensible a mayúsculas
 * en el bot— y en ningún otro. La tienda web y el checkout de Payway elegían el
 * precio "desde" entre TODOS los cristales, archivados incluidos: un cristal
 * sacado de la venta a propósito podía ser el que se le mostraba al cliente, el
 * que se le cobraba y el que se mandaba al laboratorio.
 *
 * Cualquier consulta que cotice, venda o cobre usa `WHERE_VENDIBLE`; cualquier
 * filtro en memoria usa `esArchivado`. Si mañana el archivado pasa a ser una
 * columna (`archivedAt`), se cambia ACÁ y nada más.
 */
export function esArchivado(p: { name?: string | null } | null | undefined): boolean {
    return (p?.name ?? '').trimStart().toUpperCase().startsWith(PREFIJO_ARCHIVADO);
}

/** Fragmento Prisma: excluye los archivados. Combinar siempre con AND. */
export const WHERE_VENDIBLE = {
    NOT: { name: { startsWith: PREFIJO_ARCHIVADO, mode: 'insensitive' as const } },
};
