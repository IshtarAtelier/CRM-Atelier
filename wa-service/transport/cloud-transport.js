/**
 * Transporte "cloud": misma interfaz que `whatsapp/client.js` (sendMessage,
 * getStatus, notifyAdminDown) pero implementada sobre la Cloud API oficial.
 *
 * Así el resto del servicio (routes/api.js, tools que mandan mensajes) no
 * sabe cuál transporte está abajo. Lo que cambia respecto de WhatsApp Web:
 *
 *  - Sin cola anti-ban: la API tiene rate limits generosos y no hay que
 *    "parecer humano". Queda un reintento corto para 429/5xx.
 *  - La ventana de 24 h se valida ACÁ, no en Meta: si el chat no tiene un
 *    entrante en las últimas 24 h y no vino plantilla, se rechaza con
 *    code WINDOW_CLOSED antes de gastar una llamada. El CRM traduce eso a
 *    "elegí una plantilla".
 *  - Estado = token válido + número activo (se refresca cada 5 min), no una
 *    sesión de Chromium.
 */

const { prisma } = require('../db');
const cloud = require('./cloud-api');

let phoneStatus = { configured: cloud.isConfigured(), isReady: false, connectedPhone: null, lastCheck: null, error: null };
let refreshTimer = null;

async function refreshStatus() {
    try {
        if (!cloud.isConfigured()) {
            phoneStatus = { ...phoneStatus, configured: false, isReady: false, error: 'Faltan WA_CLOUD_TOKEN / WA_CLOUD_PHONE_NUMBER_ID' };
            return phoneStatus;
        }
        const s = await cloud.getPhoneStatus();
        phoneStatus = {
            configured: true,
            isReady: true,
            connectedPhone: s.phone || null,
            verifiedName: s.verifiedName,
            qualityRating: s.qualityRating,
            messagingLimitTier: s.messagingLimitTier,
            nameStatus: s.nameStatus,
            lastCheck: new Date().toISOString(),
            error: null,
        };
    } catch (e) {
        phoneStatus = { ...phoneStatus, isReady: false, lastCheck: new Date().toISOString(), error: e.message };
        console.error('[CloudTransport] No se pudo leer el estado del número:', e.message);
    }
    return phoneStatus;
}

function getStatus() {
    return {
        transport: 'cloud',
        isReady: phoneStatus.isReady,
        state: phoneStatus.isReady ? 'CONNECTED' : (phoneStatus.configured ? 'ERROR' : 'NOT_CONFIGURED'),
        connectedPhone: phoneStatus.connectedPhone,
        qrCode: null, // no existe en la API oficial
        verifiedName: phoneStatus.verifiedName,
        qualityRating: phoneStatus.qualityRating,
        messagingLimitTier: phoneStatus.messagingLimitTier,
        lastCheck: phoneStatus.lastCheck,
        error: phoneStatus.error,
    };
}

async function init() {
    await refreshStatus();
    if (!refreshTimer) refreshTimer = setInterval(() => refreshStatus().catch(() => {}), 5 * 60 * 1000);
    if (phoneStatus.isReady) console.log(`✅ [CloudTransport] Número ${phoneStatus.connectedPhone} (${phoneStatus.verifiedName || 'sin nombre'}) · calidad ${phoneStatus.qualityRating || '?'} · límite ${phoneStatus.messagingLimitTier || '?'}`);
    else console.warn(`⚠️ [CloudTransport] Sin conexión con la API: ${phoneStatus.error}`);
    return phoneStatus;
}

async function withRetry(fn, { attempts = 3, baseMs = 2000 } = {}) {
    let last;
    for (let i = 0; i < attempts; i++) {
        try { return await fn(); } catch (e) {
            last = e;
            if (!e.retryable || i === attempts - 1) throw e;
            const wait = baseMs * Math.pow(2, i);
            console.warn(`[CloudTransport] ${e.message} — reintento en ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
    throw last;
}

/**
 * Envía un mensaje. Misma firma que whatsapp/client.js#sendMessage.
 *
 * @param {string} waId   E.164, "<num>@c.us" o "+54…" (se normaliza). Nunca @lid.
 * @param {string} content texto (o caption si hay media)
 * @param {{base64?:string,buffer?:Buffer,url?:string,mimetype:string,filename?:string}|null} media
 * @param {{ template?: {name, language?, bodyParams?, headerDocument?, headerImage?, buttonUrlParams?}, chat?: object, skipWindowCheck?: boolean }} options
 * @returns {Promise<{ id: {_serialized: string}, wamid: string, templateName?: string }>}
 */
async function sendMessage(waId, content, media = null, options = {}) {
    const to = cloud.toE164(waId);
    if (!to) {
        const err = new Error(`Destino inválido para la API oficial: ${waId}`);
        err.code = 'INVALID_NUMBER';
        throw err;
    }
    if (!phoneStatus.isReady) {
        await refreshStatus();
        if (!phoneStatus.isReady) {
            const err = new Error(`API de WhatsApp no disponible: ${phoneStatus.error || 'sin conexión'}`);
            err.code = 'NOT_CONNECTED';
            throw err;
        }
    }

    // Plantilla: vale siempre.
    if (options.template) {
        const tpl = options.template;
        // Si la plantilla lleva documento y nos dieron el archivo, primero se sube.
        if (media && !tpl.headerDocument && !tpl.headerImage) {
            const buffer = media.buffer || (media.base64 ? Buffer.from(media.base64, 'base64') : null);
            const kind = cloud.mediaKind(media.mimetype);
            if (media.url) {
                if (kind === 'image') tpl.headerImage = { link: media.url }; else tpl.headerDocument = { link: media.url, filename: media.filename };
            } else if (buffer) {
                const id = await cloud.uploadMedia(buffer, media.mimetype, media.filename);
                if (kind === 'image') tpl.headerImage = { id }; else tpl.headerDocument = { id, filename: media.filename };
            }
        }
        const r = await withRetry(() => cloud.sendTemplate(to, tpl));
        return { ...r, templateName: tpl.name };
    }

    // Texto libre / medio: solo con ventana abierta.
    if (!options.skipWindowCheck) {
        const chat = options.chat || await prisma.whatsAppChat.findFirst({
            where: { OR: [{ waId: to }, { waId: `${to}@c.us` }, { realPhone: to }] },
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true, lastInboundAt: true },
        });
        if (!cloud.isServiceWindowOpen(chat)) {
            const err = new Error('La ventana de 24 h está cerrada: el cliente no escribió en el último día. Solo se puede mandar una plantilla aprobada.');
            err.code = 'WINDOW_CLOSED';
            err.lastInboundAt = chat?.lastInboundAt || null;
            throw err;
        }
    }

    if (media && (media.base64 || media.buffer || media.url)) {
        return withRetry(() => cloud.sendMedia(to, media, content || ''));
    }
    if (!content || !String(content).trim()) {
        const err = new Error('Mensaje vacío');
        err.code = 'EMPTY_MESSAGE';
        throw err;
    }
    return withRetry(() => cloud.sendText(to, String(content)));
}

/** El buzón simula "escribiendo…" con WhatsApp Web; la Cloud API no lo tiene. No-op. */
async function sendTypingState() { return null; }

/** Aviso a la administración por email vía el CRM (mismo helper que el transporte legacy). */
async function notifyAdminDown(subject, message) {
    try {
        const base = (process.env.CRM_API_URL || '').replace('/api/bot', '');
        if (!base) return;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        await fetch(`${base}/api/admin/alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.BOT_API_KEY || '' },
            body: JSON.stringify({ subject, message }),
            signal: controller.signal,
        }).finally(() => clearTimeout(t));
    } catch (e) {
        console.error('[CloudTransport] No se pudo avisar por email:', e.message);
    }
}

module.exports = { init, refreshStatus, getStatus, sendMessage, sendTypingState, notifyAdminDown, getClient: () => null };
