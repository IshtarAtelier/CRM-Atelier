'use strict';

/**
 * "¿Este entrante ya lo atendimos?" — memoria corta por wamid.
 *
 * Meta reintenta el webhook cuando no ve el 200 a tiempo (y a veces aunque lo
 * vea). `transport/inbound.js` ya es idempotente para la PERSISTENCIA, pero eso
 * no alcanza para las REACCIONES: sin esta guarda, un reintento le dispara al
 * bot un segundo turno y el cliente recibe dos respuestas al mismo mensaje.
 *
 * Vive en memoria a propósito: un reinicio del servicio pierde la marca, y ahí
 * el peor caso es una respuesta repetida en un reintento que caiga justo en la
 * ventana del reinicio. Persistirlo en la base costaría una escritura por
 * mensaje para cubrir un caso rarísimo.
 */

const DEFAULT_MAX = 5000;

class SeenOnce {
    /** @param {number} [max] Cuántas claves recuerda antes de tirar las más viejas. */
    constructor(max = DEFAULT_MAX) {
        this.max = max;
        this.seen = new Set();
    }

    /**
     * @param {string|null|undefined} key wamid del mensaje.
     * @returns {boolean} true la PRIMERA vez que se ve la clave. Sin clave
     *   devuelve true siempre: no hay con qué deduplicar y callarse sería peor.
     */
    first(key) {
        if (!key) return true;
        if (this.seen.has(key)) return false;
        this.seen.add(key);
        if (this.seen.size > this.max) {
            // El Set conserva el orden de inserción: el primero es el más viejo.
            this.seen.delete(this.seen.values().next().value);
        }
        return true;
    }

    has(key) {
        return this.seen.has(key);
    }
}

module.exports = { SeenOnce };
