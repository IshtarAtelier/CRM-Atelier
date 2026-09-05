/**
 * Qué entrante de WhatsApp cuenta como una CONSULTA del cliente.
 *
 * POR QUÉ es compartido: el auto-respondedor ya filtraba por acá, pero el bot
 * (`bot-cloud.js` → `handleInbound`) no filtraba nada. Una reacción se guarda
 * como un mensaje de texto con el contenido "[Reacción] 👍"
 * (`transport/inbound.js` → `contenidoDe`), así que un pulgar arriba le
 * programaba al bot un turno completo y el cliente recibía otra respuesta
 * encima de la que acababa de leer. Pasó el 5/9/26 en el chat de Zulay
 * Obredor: el bot contestó 16:51, ella reaccionó 👍, y el bot volvió a
 * despedirse 16:52 con la misma frase parafraseada.
 *
 * Un sticker, un `unsupported` o un estado tampoco son una pregunta.
 */
const TIPOS_CON_CONSULTA = new Set([
    'text', 'image', 'audio', 'video', 'document', 'location', 'contacts', 'button', 'interactive',
]);

/** `true` si el entrante es una consulta que merece respuesta. */
function esConsulta(msg) {
    // Sin `type` asumimos texto: los transportes viejos no lo mandaban, y callar
    // por una duda de forma es peor que contestar de más.
    const tipo = msg && msg.type ? String(msg.type).toLowerCase() : 'text';
    return TIPOS_CON_CONSULTA.has(tipo);
}

module.exports = { TIPOS_CON_CONSULTA, esConsulta };
