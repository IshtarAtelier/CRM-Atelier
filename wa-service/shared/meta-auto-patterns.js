/**
 * Patrones de las respuestas automáticas de Meta / WhatsApp Business.
 * Fuente única — antes había 3 copias desincronizadas (index.js x2, sync.service.js).
 *
 * IMPORTANTE: si se cambia el texto del mensaje automático en Meta Business,
 * actualizar acá los patrones de "textos reales".
 */

const META_AUTO_REPLY_PATTERNS = [
    /[¡!]?hola\b.*c[oó]mo podemos ayudarte/i,
    /bienvenid[oa]\s*(a\s*)?atelier/i,
    /gracias por (contactar|escribir|comunicar|tu mensaje)/i,
    /te (responderemos|contestaremos|atenderemos) (a la brevedad|pronto|en breve)/i,
    /en breve (te responder|un asesor)/i,
    // Textos reales configurados en WhatsApp Business (ausencia y bienvenida)
    /en este momento el local est[aá] cerrado/i,
    /contame c[oó]mo puedo ayudarte/i,
    /pod[eé]s dejarme tu consulta/i,
];

function isMetaAutoReplyText(text) {
    if (!text) return false;
    return META_AUTO_REPLY_PATTERNS.some(p => p.test(text));
}

module.exports = { META_AUTO_REPLY_PATTERNS, isMetaAutoReplyText };
