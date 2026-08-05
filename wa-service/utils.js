const TAGS_SIN_BOT = [
    'cancelar bot', 
    'no bot', 
    'proveedor', 
    'no interesado', 
    'error', 
    'familiar', 
    'personal', 
    'spam', 
    'post-venta', 
    'postventa', 
    'ya es cliente', 
    'cerrado'
];

const ADMIN_PHONE_FALLBACK = '5493541215971';

function getAdminWaId() {
    const adminPhone = process.env.ADMIN_PHONE || ADMIN_PHONE_FALLBACK;
    return adminPhone.includes('@') ? adminPhone : `${adminPhone.replace(/[^0-9]/g, '')}@c.us`;
}

/**
 * Normaliza un teléfono argentino al formato de WhatsApp (549 + área + número).
 * Misma lógica que `formatPhoneForWhatsApp` del CRM (src/lib/phone-utils.ts).
 *
 * Existe porque los teléfonos cargados a mano (por ejemplo el `notifyPhone` de
 * una etiqueta) vienen como "3541215971", sin el 549: WhatsApp no los resuelve
 * ("No LID for user") y el envío falla siempre.
 */
function normalizarTelefonoAr(phone) {
    if (!phone) return '';
    let base = String(phone).replace(/\D/g, '');
    if (!base) return '';

    if (base.startsWith('549')) base = base.substring(3);
    else if (base.startsWith('54')) base = base.substring(2);

    if (base.startsWith('0')) base = base.substring(1);

    // Saca el '15' incrustado después del código de área
    if (base.length > 10) {
        const m = base.match(/^([1-3]\d{1,3})15(\d{6,8})$/);
        if (m) base = m[1] + m[2];
    }

    return '549' + base;
}

function withTimeout(promise, ms, errorMessage = 'Timeout de respuesta') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * Convierte un mimetype en una extensión de archivo.
 * Centraliza la lógica que estaba duplicada 3 veces en index.js.
 */
function getFileExtension(mimetype) {
    if (!mimetype) return 'bin';
    const map = {
        'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'webp': 'webp', 'gif': 'gif',
        'pdf': 'pdf', 'ogg': 'ogg', 'mp3': 'mp3', 'mpeg': 'mp3', 'wav': 'wav',
        'mp4': 'mp4', 'm4a': 'm4a', 'heic': 'heic', 'heif': 'heif',
        'amr': 'amr', 'aac': 'aac',
    };
    for (const [key, ext] of Object.entries(map)) {
        if (mimetype.includes(key)) return ext;
    }
    // Fallback: extraer subtipo del mimetype
    const parts = mimetype.split('/');
    if (parts.length > 1) {
        const sub = parts[1].split(';')[0].toLowerCase();
        if (/^[a-z0-9]+$/.test(sub)) return sub;
    }
    return 'bin';
}

// ── WhatsApp ID format helpers ────────────────────────
// LID = Local Internal ID (new WhatsApp format, e.g. "265656914161793@lid")
// C.US = Classic phone-based ID (e.g. "5493541215971@c.us")

/**
 * Returns true if the waId uses WhatsApp's new LID format.
 * LIDs are internal IDs that don't follow phone number conventions.
 */
function isLidFormat(waId) {
    return typeof waId === 'string' && waId.endsWith('@lid');
}

/**
 * Returns true if the waId is a group chat.
 */
function isGroupId(waId) {
    return typeof waId === 'string' && waId.includes('@g.us');
}

/**
 * Validates that a waId is a valid individual recipient.
 * - LID format: always valid (internal WhatsApp ID, no phone semantics)
 * - C.US format: must have valid international country code prefix
 * - Groups: always invalid (not an individual recipient)
 * @returns {{ valid: boolean, reason?: string }}
 */
function isValidRecipient(waId) {
    if (!waId || typeof waId !== 'string') {
        return { valid: false, reason: 'waId vacío o inválido' };
    }
    if (isGroupId(waId)) {
        return { valid: false, reason: 'Prohibido enviar mensajes automáticos a grupos' };
    }
    if (isLidFormat(waId)) {
        return { valid: true }; // LIDs are internal — no phone number validation needed
    }
    // Classic @c.us format: validate country code prefix
    const cleanPhone = waId.split('@')[0];
    
    // Allow any country code. Just verify it has a reasonable minimum length and doesn't start with a local prefix '0'
    if (cleanPhone.length < 10 || cleanPhone.startsWith('0')) {
        return { valid: false, reason: 'Falta el código de país internacional obligatorio en el destinatario' };
    }
    return { valid: true };
}

/**
 * Traduce el mensaje de un fallo de envío a un código estable.
 *
 * Existe porque el CRM avisaba "el número parece falso" ante CUALQUIER fallo:
 * una sesión trabada, un timeout subiendo el PDF o un freno anti-spam salían
 * con el mismo cartel, y mandaban a corregir una ficha que estaba perfecta.
 * Quien recibe el aviso necesita saber si el problema es el número o nosotros.
 *
 * @returns {'INVALID_NUMBER'|'NOT_CONNECTED'|'TIMEOUT'|'BLOCKED'|'UNKNOWN'}
 */
function clasificarFalloDeEnvio(mensaje) {
    const m = String(mensaje || '').toLowerCase();

    if (/whatsapp reconectando|whatsapp not connected|no está inicializado/.test(m)) {
        return 'NOT_CONNECTED';
    }
    if (/no está registrado|número inválido|numero invalido|invalid wid|not a valid user|no lid for user|phone not registered|código de país/.test(m)) {
        return 'INVALID_NUMBER';
    }
    if (/timeout/.test(m)) {
        return 'TIMEOUT';
    }
    if (/anti-spam|cold contact|límite diario|pausa de 30 días|archivados|prohibido/.test(m)) {
        return 'BLOCKED';
    }
    return 'UNKNOWN';
}

module.exports = {
    TAGS_SIN_BOT,
    ADMIN_PHONE_FALLBACK,
    getAdminWaId,
    normalizarTelefonoAr,
    withTimeout,
    getFileExtension,
    isLidFormat,
    isGroupId,
    isValidRecipient,
    clasificarFalloDeEnvio
};
