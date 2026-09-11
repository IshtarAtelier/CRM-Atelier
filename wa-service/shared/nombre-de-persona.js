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

    // Al menos DOS LETRAS de verdad. `length >= 2` cuenta cualquier carácter, y
    // un emoji ocupa dos: nombres de perfil como "😊" o "🫵🏻💪" pasaban el filtro
    // y quedaban como fichas en el embudo (3 de 66 en la semana del 9/9/2026).
    // No se puede llamar, ni buscar, ni saludar a una ficha así.
    const letras = (limpio.match(/\p{L}/gu) || []).length;
    if (letras < 2) return false;

    // "3541215971", "cliente 12345": si tiene 5+ dígitos es un teléfono disfrazado
    if ((limpio.match(/\d/g) || []).length >= 5) return false;

    const generico = limpio.toLowerCase();
    if (['contacto nuevo wa', 'contacto nuevo', 'cliente', 'desconocido', '-', 'sin nombre'].includes(generico)) return false;

    // "hola quiero info de multifocales" no es un nombre
    // "anteojo de cerca" llegó como nombre de perfil (11/9/2026): lo que uno busca no es quién es.
    if (/\b(anteojos?|lentes?|armaz[oó]n|multifocal(es)?|cerca|lejos|sol)\b/i.test(limpio)) return false;
    if (isPhrase(limpio)) return false;

    return true;
}

module.exports = { esNombreValido };
