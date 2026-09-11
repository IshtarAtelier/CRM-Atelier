/**
 * Convenciones del catálogo que más de una pantalla necesita conocer.
 */

/**
 * Prefijo que SACA UN PRODUCTO DE LA VENTA sin borrarlo.
 *
 * Un producto con ventas no se borra: borrarlo deja huérfanas esas órdenes y
 * descuadra los reportes de costo de laboratorio. Se renombra "[ARCHIVADO] …" y
 * sigue existiendo para el historial. Toda superficie que COTIZA, VENDE o COBRA
 * tiene que excluirlo — y eso se hace con `esArchivado` / `WHERE_VENDIBLE` de
 * src/lib/catalog/vendible.ts, nunca con el string a mano.
 */
export const PREFIJO_ARCHIVADO = '[ARCHIVADO]';
