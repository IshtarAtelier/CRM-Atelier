import { createHmac } from 'crypto';

// Token de corta vida para el handshake del socket.io del wa-service.
//
// Existe porque el socket del bot emite cosas sensibles (el QR de la sesión,
// los mensajes entrantes) y el navegador no puede autenticarse con la clave
// entre servicios sin exponerla al staff. Entonces: el CRM firma este token
// con esa clave (BOT_API_KEY) y se lo entrega solo a sesiones logueadas; el
// bot lo verifica localmente con la misma clave.
//
// Espejo de wa-service/shared/socket-token.js — si cambia el formato acá,
// cambia allá.
//
// TTL de 24 h = duración del JWT de sesión: una pestaña más vieja que eso ya
// está deslogueada de todos modos. El frontend además pide token fresco en
// cada intento de conexión (auth como callback), así que la expiración solo
// afecta a pestañas muertas.
const TTL_MS = 24 * 60 * 60 * 1000;

export function createSocketToken(user: { id: string; name: string }): string | null {
    const key = process.env.BOT_API_KEY || process.env.WA_API_KEY;
    if (!key) return null; // instalación sin clave: el bot tampoco exige token

    const payload = Buffer.from(JSON.stringify({
        sub: user.id,
        name: user.name,
        exp: Date.now() + TTL_MS,
    })).toString('base64url');
    const firma = createHmac('sha256', key).update(payload).digest('base64url');
    return `${payload}.${firma}`;
}
