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

module.exports = {
    TAGS_SIN_BOT,
    ADMIN_PHONE_FALLBACK,
    getAdminWaId,
    withTimeout,
    getFileExtension,
    isLidFormat,
    isGroupId,
    isValidRecipient
};
