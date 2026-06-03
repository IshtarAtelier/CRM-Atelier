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

module.exports = {
    TAGS_SIN_BOT,
    ADMIN_PHONE_FALLBACK,
    getAdminWaId,
    withTimeout
};
