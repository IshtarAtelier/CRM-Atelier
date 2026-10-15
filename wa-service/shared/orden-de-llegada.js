'use strict';

/**
 * "Qué llegó antes" en un chat se mide con el reloj del SERVIDOR.
 *
 * Por qué (auditoría del 15/10/2026): createdAt de un entrante es la hora del
 * teléfono del cliente (el timestamp que manda Meta, transport/inbound.js) y
 * la de un saliente es la nuestra. Ordenar por createdAt mezclaba dos relojes:
 * una foto de receta mandada tras "Dale, espero tu recetita" que tardó en
 * subirse quedaba "antes" de nuestra burbuja, quedaAlgoSinContestar decía que
 * no y el turno no corría. 13 casos reales en 30 días.
 *
 * Se eligió una columna (`receivedAt`, default now() del servidor) y no anclar
 * el turno al wamid que lo disparó: el turno también arranca desde el barrido
 * de vueltas y desde reintentos, donde ese wamid no está a mano, y el dueño
 * del chat (shared/duenio-del-chat.js) tiene el mismo problema sin turno de por
 * medio. La columna arregla todos los caminos con una sola regla.
 *
 * Las filas anteriores a la migración tienen receivedAt NULL: para ellas vale
 * createdAt (son todas más viejas que cualquier fila nueva, así que en el
 * orden descendente van al final).
 */

/** Momento de llegada de una fila (Date). */
function recibido(m) {
    if (!m) return null;
    const f = m.receivedAt || m.createdAt;
    return f ? new Date(f) : null;
}

/** orderBy de Prisma: el más nuevo en llegar primero. */
const ORDEN_DE_LLEGADA_DESC = Object.freeze([
    { receivedAt: { sort: 'desc', nulls: 'last' } },
    { createdAt: 'desc' },
]);

/**
 * Condición de Prisma "llegó después de `fecha`". Va adentro de un AND para
 * no pisar otro OR del where (whereSalienteHumano usa OR).
 */
function llegoDespuesDe(fecha) {
    const gt = new Date(fecha);
    return { AND: [{ OR: [{ receivedAt: { gt } }, { receivedAt: null, createdAt: { gt } }] }] };
}

module.exports = { recibido, ORDEN_DE_LLEGADA_DESC, llegoDespuesDe };
