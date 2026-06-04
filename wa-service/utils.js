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

module.exports = {
    TAGS_SIN_BOT,
    ADMIN_PHONE_FALLBACK,
    getAdminWaId,
    withTimeout,
    getFileExtension
};
