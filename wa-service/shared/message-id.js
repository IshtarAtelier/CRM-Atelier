'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Identidad de los mensajes de WhatsApp cuando WhatsApp Web deja de darla.
//
// whatsapp-web.js inyecta su propia capa dentro de WhatsApp Web. Cuando esa capa
// queda desfasada de la versión que sirve WhatsApp, el mensaje sigue llegando pero
// SIN `id._serialized`. Todo nuestro guardado de salientes colgaba de ese id:
// los `upsert({ where: { waMessageId } })` quedaban con `undefined` (Prisma tira) y
// los guardas `if (sent.id._serialized)` descartaban el mensaje sin avisar. Efecto
// real: desde el 14/7/2026 el buzón dejó de mostrar TODO lo que contestaba la óptica.
//
// Solución: un id propio y determinístico. Mismo chat + misma dirección + mismo
// texto + mismo segundo ⇒ mismo id, así los dos caminos que graban un saliente
// (el POST /send del CRM y el listener message_create) siguen colapsando en una fila.
// ─────────────────────────────────────────────────────────────────────────────

// Cuánto se recuerda un mensaje propio para no confundirlo con una persona.
// El eco de `message_create` llega en segundos: 2 minutos ya es holgadísimo.
// Estaba en 10 minutos, y esa ventana era media hora de riesgo por cada texto
// que el bot y una vendedora pueden escribir igual ("hola", "listo", "gracias").
const BOT_MEMORY_TTL_MS = 2 * 60 * 1000;

function hashContent(content) {
    return crypto.createHash('sha1').update(String(content || '')).digest('hex').slice(0, 12);
}

function normalizeContent(content) {
    return String(content || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Id serializado de un chat/mensaje/contacto.
 * En julio de 2026 WhatsApp Web renombró internamente `_serialized` a `$1`
 * (https://github.com/wwebjs/whatsapp-web.js/pull/201832). whatsapp-web.js 1.34.7
 * todavía lee solo `_serialized`, así que leemos los dos.
 */
function serializedId(idLike) {
    const value = idLike?._serialized ?? idLike?.$1;
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/** ¿WhatsApp nos dio el id real del mensaje? */
function hasRealWaMessageId(msg) {
    return serializedId(msg?.id) !== null;
}

/**
 * Id usable SIEMPRE: el real si está, uno propio determinístico si no.
 * @param {object} msg Mensaje de whatsapp-web.js (puede venir sin id._serialized)
 * @param {object} ctx { waId, direction, content, timestamp (en segundos) }
 */
function resolveWaMessageId(msg, ctx = {}) {
    const real = serializedId(msg?.id);
    if (real) return real;

    const waId = ctx.waId || msg?.to || msg?.from || 'desconocido';
    const seconds = Number(ctx.timestamp || msg?.timestamp || Math.floor(Date.now() / 1000));
    const direction = ctx.direction || (msg?.fromMe ? 'OUTBOUND' : 'INBOUND');
    const content = ctx.content !== undefined ? ctx.content : msg?.body;

    return `local_${direction === 'OUTBOUND' ? 'out' : 'in'}_${waId}_${seconds}_${hashContent(content)}`;
}

/** Los ids que inventamos nosotros arrancan con `local_`. */
function isLocalWaMessageId(waMessageId) {
    return typeof waMessageId === 'string' && waMessageId.startsWith('local_');
}

/**
 * Con id propio, dos caminos que graban el MISMO mensaje pueden caer en segundos
 * distintos y duplicar la burbuja en el buzón. Antes de crear, buscamos un gemelo
 * reciente (mismo chat, misma dirección, mismo texto).
 * @returns {Promise<object|null>} la fila ya existente, o null
 */
async function findRecentTwin(prisma, { chatId, direction, content, withinMs = 120000 }) {
    if (!chatId) return null;
    return prisma.whatsAppMessage.findFirst({
        where: {
            chatId,
            direction,
            content: content || '',
            createdAt: { gte: new Date(Date.now() - withinMs) },
        },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Recordar un mensaje que mandó el bot, para que el listener de salientes no lo
 * confunda con una intervención humana y apague el bot solo. Se recuerda por id
 * (cuando lo hay) y SIEMPRE por contenido, que es lo único que sobrevive cuando
 * WhatsApp Web no entrega el id.
 */
function rememberBotMessage(sent, content) {
    if (!global.botMessageIds) global.botMessageIds = new Set();
    if (!global.botMessageContents) global.botMessageContents = new Map();

    const id = serializedId(sent?.id);
    if (id) {
        global.botMessageIds.add(id);
        setTimeout(() => global.botMessageIds.delete(id), BOT_MEMORY_TTL_MS);
    }

    const key = normalizeContent(content ?? sent?.body);
    if (key) {
        global.botMessageContents.set(key, Date.now());
        setTimeout(() => global.botMessageContents.delete(key), BOT_MEMORY_TTL_MS);
    }
}

/**
 * ¿Este saliente lo mandó el bot (y no una persona)?
 *
 * La marca se CONSUME al primer match. El eco de un mensaje del bot llega UNA
 * sola vez (`message_create` está registrado en un solo lugar), así que un
 * segundo saliente con el mismo texto ya es una persona escribiendo.
 *
 * Sin esto, la marca por contenido —que no distingue de qué chat es— tapaba a
 * la vendedora: si el bot había mandado "hola, contame" en cualquier chat, y
 * ella escribía ese mismo texto en otro, su mensaje se leía como propio del bot
 * y la conversación NO se cortaba: el bot le seguía contestando por encima.
 */
function wasSentByBot(msg) {
    const id = serializedId(msg?.id);
    const key = normalizeContent(msg?.body);

    const porId = Boolean(id && global.botMessageIds && global.botMessageIds.has(id));
    const porContenido = Boolean(key && global.botMessageContents && global.botMessageContents.has(key));
    if (!porId && !porContenido) return false;

    if (id && global.botMessageIds) global.botMessageIds.delete(id);
    if (key && global.botMessageContents) global.botMessageContents.delete(key);
    return true;
}

module.exports = {
    serializedId,
    resolveWaMessageId,
    hasRealWaMessageId,
    isLocalWaMessageId,
    findRecentTwin,
    rememberBotMessage,
    wasSentByBot,
};
