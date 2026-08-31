/**
 * Cliente de la WhatsApp Cloud API (API oficial de Meta).
 *
 * Es el ÚNICO lugar del wa-service que habla con graph.facebook.com para
 * WhatsApp. Ningún otro archivo hace fetch a Graph: si hace falta algo nuevo
 * (reacciones, botones interactivos, etc.) se agrega acá.
 *
 * Reemplaza a `whatsapp/client.js` (whatsapp-web.js + Chromium + QR) cuando
 * WA_TRANSPORT=cloud. No hay sesión que mantener, no hay QR, no hay cola
 * anti-ban: la API es un endpoint HTTPS con token.
 *
 * Reglas que hace cumplir:
 *  - Texto libre y medios SOLO dentro de la ventana de servicio de 24 h
 *    (último mensaje entrante del cliente). Fuera, solo plantillas.
 *  - Los destinos son E.164 sin "+": 5493518685644. Nada de @c.us / @lid.
 *  - El token no se loguea nunca, ni parcialmente.
 *
 * Env: WA_CLOUD_TOKEN, WA_CLOUD_PHONE_NUMBER_ID, WA_CLOUD_WABA_ID,
 *      WA_CLOUD_API_VERSION (default v21.0).
 */

// Solo para pruebas locales (mock de Graph): en producción NO se setea.
const GRAPH = process.env.WA_CLOUD_GRAPH_URL || 'https://graph.facebook.com';
const API_VERSION = process.env.WA_CLOUD_API_VERSION || 'v21.0';
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function cfg() {
    return {
        token: process.env.WA_CLOUD_TOKEN || '',
        phoneNumberId: process.env.WA_CLOUD_PHONE_NUMBER_ID || '',
        wabaId: process.env.WA_CLOUD_WABA_ID || '',
    };
}

function isConfigured() {
    const c = cfg();
    return Boolean(c.token && c.phoneNumberId);
}

class CloudApiError extends Error {
    constructor(message, { code, status, metaCode, metaSubcode, retryable, ambiguous } = {}) {
        super(message);
        this.name = 'CloudApiError';
        this.code = code || 'CLOUD_API_ERROR';
        this.status = status;
        this.metaCode = metaCode;
        this.metaSubcode = metaSubcode;
        this.retryable = Boolean(retryable);
        // true = no sabemos si el envío llegó a concretarse del lado de Meta.
        // Quien reintenta un envío TIENE que mirar esto: reintentar un ambiguo
        // le manda el mensaje dos veces al cliente y factura dos conversaciones.
        this.ambiguous = Boolean(ambiguous);
    }
}

/**
 * Normaliza cualquier forma de destino a E.164 sin "+".
 * Acepta "5493518685644", "+54 9 351 868-5644", "5493518685644@c.us".
 * Devuelve null si no parece un teléfono.
 */
function toE164(dest) {
    if (!dest) return null;
    let s = String(dest);
    if (s.includes('@lid')) return null; // un LID no es un teléfono
    s = s.replace(/@c\.us$|@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (s.length < 10 || s.length > 15) return null;
    return s;
}

/**
 * ¿La ventana de servicio de 24 h está abierta para este chat?
 * @param {{ lastInboundAt?: Date|string|null }} chat
 */
function isServiceWindowOpen(chat, now = Date.now()) {
    if (!chat || !chat.lastInboundAt) return false;
    const t = new Date(chat.lastInboundAt).getTime();
    return Number.isFinite(t) && now - t < SERVICE_WINDOW_MS;
}

/** Milisegundos que le quedan a la ventana (0 si está cerrada). */
function serviceWindowRemainingMs(chat, now = Date.now()) {
    if (!chat || !chat.lastInboundAt) return 0;
    const t = new Date(chat.lastInboundAt).getTime();
    return Math.max(0, SERVICE_WINDOW_MS - (now - t));
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function graphFetch(path, { method = 'GET', body, headers = {}, timeoutMs = 20000, raw = false } = {}) {
    const { token } = cfg();
    if (!token) throw new CloudApiError('WA_CLOUD_TOKEN no configurado', { code: 'NOT_CONFIGURED' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${GRAPH}/${API_VERSION}/${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, ...headers },
            body,
            signal: controller.signal,
        });
        if (raw) return res;
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
        if (!res.ok) {
            const err = json?.error || {};
            // Rate limit / transitorio: 429, 5xx, o códigos de Meta 4, 17, 80007, 130429
            const retryable = res.status === 429 || res.status >= 500 ||
                [4, 17, 80007, 130429, 131056].includes(err.code);
            // `ambiguous`: no sabemos si Meta llegó a procesar el mensaje. Un 5xx
            // puede venir después de que la conversación ya se creó. Reintentar
            // eso duplica el mensaje al cliente y la conversación facturada.
            // Un 429 / rate limit, en cambio, es un rechazo limpio: no salió nada.
            const ambiguous = res.status >= 500;
            throw new CloudApiError(
                `Graph ${res.status}: ${err.message || text?.slice(0, 200) || 'sin detalle'}`,
                { code: mapMetaError(err.code), status: res.status, metaCode: err.code, metaSubcode: err.error_subcode, retryable, ambiguous }
            );
        }
        return json;
    } catch (e) {
        // Abortamos NOSOTROS por timeout: Meta pudo haber aceptado igual. Ambiguo.
        if (e.name === 'AbortError') throw new CloudApiError(`Timeout de ${timeoutMs}ms llamando a Graph`, { code: 'TIMEOUT', retryable: true, ambiguous: true });
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

/** Códigos de Meta que el CRM quiere distinguir (para decirle algo útil al vendedor). */
function mapMetaError(metaCode) {
    switch (metaCode) {
        case 131047: return 'WINDOW_CLOSED';        // re-engagement: pasaron 24 h
        case 131026: return 'INVALID_NUMBER';       // destinatario no puede recibir (sin WhatsApp)
        case 131030: return 'RECIPIENT_NOT_ALLOWED';// número de prueba: destinatario no está en la lista
        case 132000: case 132001: case 132005: case 132007: case 132012: return 'TEMPLATE_ERROR';
        case 190: return 'TOKEN_INVALID';
        case 100: return 'BAD_REQUEST';
        case 4: case 17: case 80007: case 130429: return 'RATE_LIMITED';
        default: return 'CLOUD_API_ERROR';
    }
}

// ── Envíos ───────────────────────────────────────────────────────────────────

function messagesPath() {
    const { phoneNumberId } = cfg();
    if (!phoneNumberId) throw new CloudApiError('WA_CLOUD_PHONE_NUMBER_ID no configurado', { code: 'NOT_CONFIGURED' });
    return `${phoneNumberId}/messages`;
}

async function postMessage(payload) {
    const json = await graphFetch(messagesPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    });
    const wamid = json?.messages?.[0]?.id || null;
    // Forma compatible con resolveWaMessageId() del buzón (lee id._serialized).
    return { id: { _serialized: wamid }, wamid, raw: json };
}

/** Texto libre (solo con ventana abierta — lo valida quien llama). */
async function sendText(to, text, { previewUrl = false } = {}) {
    return postMessage({ to, type: 'text', text: { body: text, preview_url: previewUrl } });
}

/**
 * Sube un archivo a Meta y devuelve el media id (válido 30 días).
 * @param {Buffer} buffer
 */
async function uploadMedia(buffer, mimetype, filename = 'archivo') {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimetype);
    form.append('file', new Blob([buffer], { type: mimetype }), filename);
    const { phoneNumberId } = cfg();
    const json = await graphFetch(`${phoneNumberId}/media`, { method: 'POST', body: form, timeoutMs: 60000 });
    if (!json?.id) throw new CloudApiError('Meta no devolvió id de media', { code: 'MEDIA_UPLOAD_FAILED' });
    return json.id;
}

function mediaKind(mimetype = '') {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('video/')) return 'video';
    return 'document';
}

/**
 * Medio + caption opcional (ventana abierta). `media` = { base64 | buffer | url, mimetype, filename }.
 */
async function sendMedia(to, media, caption = '') {
    const kind = mediaKind(media.mimetype);
    let ref;
    if (media.url) {
        ref = { link: media.url };
    } else {
        const buffer = media.buffer || Buffer.from(media.base64, 'base64');
        const id = await uploadMedia(buffer, media.mimetype, media.filename);
        ref = { id };
    }
    const obj = { ...ref };
    if (caption && kind !== 'audio') obj.caption = caption;
    if (kind === 'document' && media.filename) obj.filename = media.filename;
    return postMessage({ to, type: kind, [kind]: obj });
}

/**
 * Plantilla aprobada. Sirve dentro y fuera de la ventana.
 * @param {string} to
 * @param {{ name: string, language?: string, bodyParams?: string[], headerDocument?: {id?:string, link?:string, filename?:string}, headerImage?: {id?:string, link?:string}, buttonUrlParams?: string[] }} tpl
 */
async function sendTemplate(to, tpl) {
    const components = [];
    if (tpl.headerDocument) {
        components.push({ type: 'header', parameters: [{ type: 'document', document: tpl.headerDocument }] });
    } else if (tpl.headerImage) {
        components.push({ type: 'header', parameters: [{ type: 'image', image: tpl.headerImage }] });
    }
    if (tpl.bodyParams && tpl.bodyParams.length) {
        components.push({ type: 'body', parameters: tpl.bodyParams.map(t => ({ type: 'text', text: String(t) })) });
    }
    if (tpl.buttonUrlParams && tpl.buttonUrlParams.length) {
        tpl.buttonUrlParams.forEach((p, i) => {
            components.push({ type: 'button', sub_type: 'url', index: String(i), parameters: [{ type: 'text', text: String(p) }] });
        });
    }
    return postMessage({
        to,
        type: 'template',
        template: { name: tpl.name, language: { code: tpl.language || 'es_AR' }, components },
    });
}

/** Marca un mensaje entrante como leído (doble tilde azul del lado del cliente). */
async function markRead(wamid) {
    if (!wamid) return null;
    return graphFetch(messagesPath(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamid }),
    }).catch(e => { console.warn('[CloudAPI] markRead falló:', e.message); return null; });
}

// ── Medios entrantes ─────────────────────────────────────────────────────────

/**
 * Descarga un medio entrante por su id. Meta devuelve primero una URL firmada
 * de corta vida y después los bytes (siempre con el token en el header).
 * @returns {{ buffer: Buffer, mimetype: string, sha256?: string, size?: number }}
 */
async function downloadMedia(mediaId) {
    const meta = await graphFetch(mediaId);
    if (!meta?.url) throw new CloudApiError('Meta no devolvió URL del media', { code: 'MEDIA_URL_MISSING' });
    // La URL firmada es absoluta (no pasa por graphFetch, que arma GRAPH/version/path).
    // Se le pega directo, con el mismo token en el header.
    const { token } = cfg();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
        const r = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!r.ok) throw new CloudApiError(`Descarga de media ${r.status}`, { code: 'MEDIA_DOWNLOAD_FAILED', status: r.status, retryable: r.status >= 500 });
        const buffer = Buffer.from(await r.arrayBuffer());
        return { buffer, mimetype: meta.mime_type || r.headers.get('content-type') || 'application/octet-stream', sha256: meta.sha256, size: meta.file_size };
    } finally {
        clearTimeout(timer);
    }
}

// ── Estado del número y plantillas ───────────────────────────────────────────

/** Estado del número: nombre verificado, calidad, límite de mensajería. */
async function getPhoneStatus() {
    const { phoneNumberId } = cfg();
    if (!phoneNumberId) return { configured: false };
    const j = await graphFetch(`${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier,name_status,code_verification_status,platform_type`);
    return {
        configured: true,
        phone: (j.display_phone_number || '').replace(/\D/g, ''),
        displayPhone: j.display_phone_number,
        verifiedName: j.verified_name,
        qualityRating: j.quality_rating,          // GREEN | YELLOW | RED | UNKNOWN
        messagingLimitTier: j.messaging_limit_tier, // TIER_250 | TIER_1K | ...
        nameStatus: j.name_status,
        codeVerificationStatus: j.code_verification_status,
        platformType: j.platform_type,
    };
}

/** Lista de plantillas del WABA (todas las páginas). */
async function listTemplates() {
    const { wabaId } = cfg();
    if (!wabaId) throw new CloudApiError('WA_CLOUD_WABA_ID no configurado', { code: 'NOT_CONFIGURED' });
    const out = [];
    let path = `${wabaId}/message_templates?fields=id,name,language,category,status,components,quality_score&limit=100`;
    for (let guard = 0; guard < 20 && path; guard++) {
        const j = await graphFetch(path);
        out.push(...(j.data || []));
        const next = j.paging?.next;
        path = next ? next.replace(`${GRAPH}/${API_VERSION}/`, '') : null;
    }
    return out;
}

/**
 * Crea una plantilla en Meta (queda PENDING hasta que la aprueben).
 * @param {{ name: string, language?: string, category: 'UTILITY'|'MARKETING'|'AUTHENTICATION', components: any[] }} tpl
 */
async function createTemplate(tpl) {
    const { wabaId } = cfg();
    if (!wabaId) throw new CloudApiError('WA_CLOUD_WABA_ID no configurado', { code: 'NOT_CONFIGURED' });
    return graphFetch(`${wabaId}/message_templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tpl.name, language: tpl.language || 'es_AR', category: tpl.category, components: tpl.components }),
    });
}

module.exports = {
    API_VERSION,
    SERVICE_WINDOW_MS,
    CloudApiError,
    isConfigured,
    toE164,
    isServiceWindowOpen,
    serviceWindowRemainingMs,
    sendText,
    sendMedia,
    sendTemplate,
    uploadMedia,
    markRead,
    downloadMedia,
    getPhoneStatus,
    listTemplates,
    createTemplate,
    mediaKind,
};
