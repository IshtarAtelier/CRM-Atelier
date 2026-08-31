/**
 * Persistencia de mensajes ENTRANTES y de ESTADOS para la API oficial.
 *
 * Es la parte de `handleMessage()` (index.js) que sobrevive sin bot: guardar
 * el chat, guardar el mensaje, bajar el medio, vincular con la ficha, emitir
 * los eventos de socket que el buzón ya escucha. Nada de IA acá.
 *
 * Contrato de entrada (lo produce webhook.js normalizando el payload de Meta):
 *   {
 *     from: '5493518685644',          // E.164 sin +
 *     profileName: 'Julio',
 *     wamid: 'wamid.HBg…',
 *     timestamp: 1723999999,           // epoch segundos
 *     type: 'text'|'image'|'audio'|'video'|'document'|'sticker'|'location'|'contacts'|'reaction'|'button'|'interactive'|'unsupported',
 *     text: 'hola',                    // texto o caption
 *     media: { id, mime_type, filename?, sha256? } | null,
 *     referral: {...} | null,          // click-to-WhatsApp de Meta Ads
 *     context: { id } | null           // a qué mensaje responde
 *   }
 */

const { prisma } = require('../db');
const { prefillAdTag, fallbackAdTag } = require('../shared/ad-tag');
const { uploadMediaToCrm } = require('../shared/media');
const cloud = require('./cloud-api');

const TYPE_MAP = {
    text: 'TEXT', image: 'IMAGE', audio: 'AUDIO', video: 'VIDEO', document: 'DOCUMENT',
    sticker: 'IMAGE', location: 'TEXT', contacts: 'TEXT', reaction: 'TEXT',
    button: 'TEXT', interactive: 'TEXT', unsupported: 'TEXT',
};

/**
 * Texto que se guarda en `content` cuando el mensaje no es de texto.
 */
function describeNonText(m) {
    switch (m.type) {
        case 'location': return m.location ? `[Ubicación] ${m.location.name || ''} ${m.location.address || ''} (${m.location.latitude}, ${m.location.longitude})`.trim() : '[Ubicación]';
        case 'contacts': return `[Contacto] ${(m.contacts || []).map(c => c?.name?.formatted_name).filter(Boolean).join(', ')}`.trim();
        case 'reaction': return `[Reacción] ${m.reaction?.emoji || ''}`.trim();
        case 'button': return m.button?.text || '[Botón]';
        case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '[Respuesta interactiva]';
        case 'sticker': return '[Sticker]';
        case 'unsupported': return '[Mensaje no soportado]';
        default: return m.text || `[Mensaje ${m.type}]`;
    }
}

/**
 * Busca la ficha del CRM por los últimos 8 dígitos del teléfono (mismo criterio
 * que index.js). Devuelve el id o null.
 */
async function findClientIdByPhone(phone) {
    if (!phone || phone.length < 8) return null;
    const tail = phone.slice(-8);
    const rows = await prisma.$queryRaw`
        SELECT id FROM "Client"
        WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE ${'%' + tail}
        LIMIT 2
    `;
    // Con dos candidatos no se elige ninguno: vincular a la ficha equivocada es
    // peor que dejarlo sin vincular (lo resuelve el staff desde el buzón).
    return rows.length === 1 ? rows[0].id : null;
}

// Candado por remitente: Meta puede entregar el mismo evento dos veces casi al
// mismo tiempo (o dos mensajes seguidos del mismo cliente). Serializar por
// `from` hace que el chequeo de duplicado y el increment de unread no corran
// en paralelo sobre el mismo chat.
const locks = new Map();
function withLock(key, fn) {
    const prev = locks.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    locks.set(key, next);
    next.finally(() => { if (locks.get(key) === next) locks.delete(key); });
    return next;
}

/**
 * Guarda un entrante. Idempotente por wamid (Meta puede reentregar).
 * @returns {{ chat, created: boolean }}
 */
function persistInbound(m, deps = {}) {
    return withLock(String(m.from || 'x'), () => persistInboundUnlocked(m, deps));
}

async function persistInboundUnlocked(m, { io } = {}) {
    const waId = cloud.toE164(m.from);
    if (!waId) {
        console.warn('[Inbound] Remitente sin teléfono válido, se ignora:', m.from);
        return { chat: null, created: false };
    }

    // Idempotencia: si ya está, no se toca nada (ni unread, ni lastInboundAt).
    if (m.wamid) {
        const dup = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: m.wamid }, select: { id: true, chatId: true } });
        if (dup) return { chat: await prisma.whatsAppChat.findUnique({ where: { id: dup.chatId } }), created: false };
    }

    const now = m.timestamp ? new Date(Number(m.timestamp) * 1000) : new Date();
    const messageType = TYPE_MAP[m.type] || 'TEXT';
    const rawText = m.type === 'text' ? (m.text || '') : (m.text || describeNonText(m));
    const content = rawText || `[Mensaje ${messageType}]`;

    // ── Chat: crear o actualizar ────────────────────────────────────────────
    // waId = E.164. Un chat viejo del transporte anterior puede existir como
    // "<num>@c.us": se migra al vuelo para no duplicar la conversación.
    let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
    if (!chat) {
        const legacy = await prisma.whatsAppChat.findFirst({
            where: { OR: [{ waId: `${waId}@c.us` }, { realPhone: waId }] },
            orderBy: { lastMessageAt: 'desc' },
        });
        if (legacy) {
            chat = await prisma.whatsAppChat.update({ where: { id: legacy.id }, data: { waId, realPhone: waId } });
            console.log(`  ♻️ [Inbound] Chat legacy ${legacy.waId} migrado a ${waId}`);
        }
    }

    const commonUpdate = {
        lastMessageAt: now,
        lastInboundAt: now,
        unreadCount: { increment: 1 },
        archived: false, // un mensaje nuevo siempre vuelve al buzón activo
    };
    let created = false;
    if (!chat) {
        try {
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId, realPhone: waId, profileName: m.profileName || null,
                    // botEnabled queda en el default del schema (true): el bot
                    // volvió con la API oficial (bot-cloud.js) y un chat nuevo
                    // nacía apagado, así que nunca atendía a un prospecto nuevo.
                    // El interruptor maestro es SystemSetting.bot_enabled; este
                    // campo es el "apagalo solo en este chat" del buzón.
                    status: 'OPEN',
                    lastMessageAt: now, lastInboundAt: now, unreadCount: 1,
                },
            });
            created = true;
        } catch (e) {
            if (e.code !== 'P2002') throw e; // carrera con otro webhook: ya existe
            chat = await prisma.whatsAppChat.update({ where: { waId }, data: commonUpdate });
        }
    } else {
        const data = { ...commonUpdate };
        if (m.profileName && !chat.clientId) data.profileName = m.profileName;
        if (!chat.realPhone) data.realPhone = waId;
        chat = await prisma.whatsAppChat.update({ where: { id: chat.id }, data });
    }

    // ── Vincular con la ficha del CRM ───────────────────────────────────────
    if (!chat.clientId) {
        const clientId = await findClientIdByPhone(waId).catch(() => null);
        if (clientId) {
            chat = await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { clientId } });
            console.log(`  🔗 [Inbound] Chat ${waId} vinculado a la ficha ${clientId}`);
        }
    }

    // ── Etiqueta de anuncio (primer toque) ──────────────────────────────────
    // Dos fuentes: el texto precargado ([metaXxx]) y el `referral` que manda la
    // Cloud API en los click-to-WhatsApp (source_id = id del anuncio). La
    // segunda no existía con WhatsApp Web: es más confiable que el prefill.
    const adTag = prefillAdTag(rawText) || (m.referral ? `[metaAd:${m.referral.source_id || m.referral.source_type || 'ad'}]` : null) || fallbackAdTag(rawText);
    if (adTag) {
        await prisma.whatsAppChat.updateMany({ where: { id: chat.id, adTag: null }, data: { adTag } }).catch(() => {});
        if (chat.clientId) await prisma.client.updateMany({ where: { id: chat.clientId, adTag: null }, data: { adTag } }).catch(() => {});
    }

    // ── Medio: bajar de Meta y subir al CRM ─────────────────────────────────
    let mediaUrl = null;
    if (m.media?.id) {
        try {
            const { buffer, mimetype } = await cloud.downloadMedia(m.media.id);
            const ext = (m.media.filename && m.media.filename.includes('.')) ? m.media.filename.split('.').pop() : null;
            const filename = m.media.filename || `in_${Date.now()}${ext ? '.' + ext : ''}`;
            mediaUrl = await uploadMediaToCrm(buffer, mimetype || m.media.mime_type, filename, 'inbound');
        } catch (e) {
            console.error('[Inbound] No se pudo bajar/subir el medio:', e.message);
        }
    }

    // ── Mensaje ─────────────────────────────────────────────────────────────
    const waMessageId = m.wamid || `cloud_in_${waId}_${Math.floor(now.getTime() / 1000)}`;
    try {
        await prisma.whatsAppMessage.upsert({
            where: { waMessageId },
            update: mediaUrl ? { mediaUrl } : {},
            create: {
                chatId: chat.id, direction: 'INBOUND', type: messageType,
                content, mediaUrl, waMessageId, status: 'RECEIVED',
                createdAt: now,
            },
        });
    } catch (e) {
        if (e.code !== 'P2002') throw e; // carrera residual: ya está guardado
    }

    // ── Eventos para el buzón (mismos nombres que hoy) ──────────────────────
    if (io) {
        io.emit('chat_updated', { chatId: chat.id });
        io.emit('new_message_received', {
            chatId: chat.id,
            name: m.profileName || chat.profileName || 'Cliente',
            phone: waId,
            content: messageType === 'TEXT' ? content : `[Mensaje ${messageType}]`,
            botEnabled: chat.botEnabled,
        });
    }

    return { chat, created };
}

/**
 * Guarda un mensaje que el equipo mandó desde el CELULAR o WhatsApp Web
 * (webhook `smb_message_echoes` del modo coexistencia).
 *
 * Diferencias deliberadas con `persistInbound`:
 *  - `direction: 'OUTBOUND'` y `senderName: 'Teléfono'` — lo escribió una
 *    persona desde afuera del CRM, no el cliente ni el bot.
 *  - NO incrementa `unreadCount`: nadie tiene que "leer" lo que uno mismo
 *    escribió.
 *  - NO toca `lastInboundAt`: un eco no abre la ventana de 24 h de Meta.
 *    Si la tocara, el buzón diría "podés escribir texto libre" cuando en
 *    realidad la ventana sigue cerrada y el envío fallaría.
 *  - Si el chat no existe todavía, se crea: puede ser una conversación que
 *    arrancó el negocio desde el teléfono.
 */
function persistEcho(e, deps = {}) {
    return withLock(String(e.to || 'x'), () => persistEchoUnlocked(e, deps));
}

async function persistEchoUnlocked(e, { io } = {}) {
    const waId = cloud.toE164(e.to);
    if (!waId) {
        console.warn('[Eco] Destinatario sin teléfono válido, se ignora:', e.to);
        return { chat: null, created: false };
    }

    // Idempotencia por wamid: Meta puede reintentar el webhook.
    if (e.wamid) {
        const dup = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: e.wamid }, select: { id: true } });
        if (dup) return { chat: null, created: false };
    }

    const now = e.timestamp ? new Date(Number(e.timestamp) * 1000) : new Date();
    const messageType = TYPE_MAP[e.type] || 'TEXT';
    const rawText = e.type === 'text' ? (e.text || '') : (e.text || describeNonText(e));
    const content = rawText || `[Mensaje ${messageType}]`;

    // Mismo criterio de chat que el entrante, incluida la migración del waId
    // legacy "<num>@c.us" para no duplicar la conversación.
    let chat = await prisma.whatsAppChat.findUnique({ where: { waId } });
    if (!chat) {
        const legacy = await prisma.whatsAppChat.findFirst({
            where: { OR: [{ waId: `${waId}@c.us` }, { realPhone: waId }] },
            orderBy: { lastMessageAt: 'desc' },
        });
        if (legacy) chat = await prisma.whatsAppChat.update({ where: { id: legacy.id }, data: { waId, realPhone: waId } });
    }

    let created = false;
    if (!chat) {
        try {
            chat = await prisma.whatsAppChat.create({
                data: {
                    waId, realPhone: waId, status: 'OPEN', botEnabled: false,
                    lastMessageAt: now, unreadCount: 0,
                },
            });
            created = true;
        } catch (err) {
            if (err.code !== 'P2002') throw err;
            chat = await prisma.whatsAppChat.update({ where: { waId }, data: { lastMessageAt: now } });
        }
    } else {
        chat = await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { lastMessageAt: now } });
    }

    if (!chat.clientId) {
        const clientId = await findClientIdByPhone(waId).catch(() => null);
        if (clientId) chat = await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { clientId } });
    }

    let mediaUrl = null;
    if (e.media?.id) {
        try {
            const { buffer, mimetype } = await cloud.downloadMedia(e.media.id);
            const ext = (e.media.filename && e.media.filename.includes('.')) ? e.media.filename.split('.').pop() : null;
            const filename = e.media.filename || `eco_${Date.now()}${ext ? '.' + ext : ''}`;
            mediaUrl = await uploadMediaToCrm(buffer, mimetype || e.media.mime_type, filename, 'outbound');
        } catch (err) {
            console.error('[Eco] No se pudo bajar/subir el medio:', err.message);
        }
    }

    const waMessageId = e.wamid || `cloud_echo_${waId}_${Math.floor(now.getTime() / 1000)}`;
    try {
        await prisma.whatsAppMessage.upsert({
            where: { waMessageId },
            update: mediaUrl ? { mediaUrl } : {},
            create: {
                chatId: chat.id, direction: 'OUTBOUND', type: messageType,
                content, mediaUrl, waMessageId, status: 'SENT',
                senderName: 'Teléfono', createdAt: now,
            },
        });
    } catch (err) {
        if (err.code !== 'P2002') throw err;
    }

    // Solo `chat_updated`: el buzón refresca el hilo, pero NO se avisa como
    // "mensaje nuevo" — lo escribió el propio equipo.
    if (io) io.emit('chat_updated', { chatId: chat.id });

    console.log(`  📲 [Eco] Mensaje del teléfono guardado en el chat ${waId}`);
    return { chat, created };
}

/**
 * Actualiza el estado de un saliente: sent → delivered → read, o failed.
 * Meta manda uno por transición; se guarda el más avanzado.
 */
const STATUS_RANK = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 9 };
async function persistStatus(s, { io } = {}) {
    if (!s?.id || !s?.status) return;
    const status = String(s.status).toUpperCase(); // sent|delivered|read|failed
    const row = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: s.id }, select: { id: true, chatId: true, status: true } });
    if (!row) return; // saliente que no salió de acá (p. ej. de otro sistema): se ignora
    const cur = STATUS_RANK[row.status] || 0;
    if ((STATUS_RANK[status] || 0) <= cur && status !== 'FAILED') return;
    const data = { status };
    if (status === 'FAILED') {
        const err = s.errors?.[0];
        if (err) data.content = undefined; // el contenido no se toca; el motivo va al log
        console.warn(`[Status] Envío ${s.id} FAILED: ${err?.code || ''} ${err?.title || ''} ${err?.message || ''}`);
    }
    await prisma.whatsAppMessage.update({ where: { id: row.id }, data }).catch(() => {});
    if (io) io.emit('chat_updated', { chatId: row.chatId });
}

module.exports = { persistInbound, persistStatus, persistEcho, findClientIdByPhone };
