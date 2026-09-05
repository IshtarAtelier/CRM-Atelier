/**
 * Quién escribió un saliente: el sistema, o una persona del equipo.
 *
 * POR QUÉ importa: al armar el historial para el modelo, TODO saliente se
 * mandaba como `role: 'ai'` — o sea, como palabras del propio bot. Cuando una
 * vendedora atiende el chat a mano, el bot lee lo que ella escribió como si lo
 * hubiera dicho él: da por hecho que ya cotizó, que ya prometió una fecha o que
 * ya pidió la receta, y sigue desde ahí. Es la misma confusión que hace que
 * repita o se contradiga después de un traspaso.
 *
 * La lista ya vivía en `auto-responder.js`; acá queda una sola vez para que el
 * bot y el auto-respondedor no puedan divergir sobre qué es "un humano".
 */

/** Firma del auto-respondedor (mensaje fijo fuera de horario). */
const SENDER_NAME_AUTORESPONDEDOR = 'Auto-respondedor';

/**
 * Nombres de remitente que NO son una persona del equipo.
 * 'Teléfono' es el eco de un mensaje escrito desde la app de WhatsApp del
 * local: ESO SÍ lo escribió un humano, por eso no está en la lista.
 */
const REMITENTES_NO_HUMANOS = new Set([SENDER_NAME_AUTORESPONDEDOR, 'Bot', 'Sistema']);

/** `true` si el saliente lo escribió una persona del equipo. */
function esRemitenteHumano(senderName) {
    if (!senderName) return false; // sin firma no se asume una persona
    return !REMITENTES_NO_HUMANOS.has(senderName);
}

module.exports = { SENDER_NAME_AUTORESPONDEDOR, REMITENTES_NO_HUMANOS, esRemitenteHumano };
