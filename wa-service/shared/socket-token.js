const { createHmac, timingSafeEqual } = require('crypto');

/**
 * Verifica el token de handshake del socket.io.
 *
 * El CRM lo firma con la clave compartida entre servicios (BOT_API_KEY) y se
 * lo da SOLO a sesiones logueadas (src/lib/socket-token.ts — espejo de este
 * archivo: si cambia el formato acá, cambia allá). Así el navegador nunca ve
 * la clave, y este servicio valida localmente, sin round-trip al CRM.
 *
 * Formato: base64url(JSON {sub, name, exp}) + "." + base64url(HMAC-SHA256).
 *
 * @returns {{sub: string, name: string, exp: number}|null} payload si es
 *   válido y no expiró; null en cualquier otro caso.
 */
function verificarSocketToken(token, key) {
    if (!token || typeof token !== 'string' || !key) return null;

    const punto = token.lastIndexOf('.');
    if (punto <= 0) return null;
    const payload = token.slice(0, punto);
    const firma = token.slice(punto + 1);

    const esperada = createHmac('sha256', key).update(payload).digest('base64url');
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    let datos;
    try {
        datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
    if (!datos || typeof datos.exp !== 'number' || Date.now() > datos.exp) return null;
    return datos;
}

module.exports = { verificarSocketToken };
