const { isPhrase } = require('../tools');

/**
 * ¿Este string es el nombre de una persona, o basura que no sirve para una ficha?
 *
 * Vive acá y no en passive-extractor.js porque ahora lo usan dos caminos: el
 * extractor con IA (transporte legacy) y el alta de ficha del webhook de la API
 * oficial (transport/alta-de-ficha.js). Una sola definición: si un día se acepta
 * un nombre nuevo, se acepta en los dos lados o en ninguno.
 *
 * Ante la duda devuelve false. Una ficha sin crear la crea después una persona;
 * una ficha llamada "Hola quiero info" ensucia el CRM para siempre.
 */
function esNombreValido(nombre) {
    if (!nombre || typeof nombre !== 'string') return false;
    const limpio = nombre.trim();
    if (limpio.length < 2) return false;

    // "3541215971", "cliente 12345": si tiene 5+ dígitos es un teléfono disfrazado
    if ((limpio.match(/\d/g) || []).length >= 5) return false;

    const generico = limpio.toLowerCase();
    if (['contacto nuevo wa', 'contacto nuevo', 'cliente', 'desconocido', '-', 'sin nombre'].includes(generico)) return false;

    // "hola quiero info de multifocales" no es un nombre
    if (isPhrase(limpio)) return false;

    return true;
}

module.exports = { esNombreValido };
