/**
 * Renueva el GOOGLE_YOUTUBE_REFRESH_TOKEN (se corre cuando subir-youtube.mjs
 * falla con `invalid_grant`).
 *
 *   node --env-file=.env scripts/social/oauth-youtube.mjs
 *
 * Por qué vence: el proyecto de Google Cloud "atelier-youtube" está en modo
 * PRUEBA (no pasó la auditoría de Google), y a las apps en prueba Google les
 * vence el refresh token a los 7 días. Hasta que se publique la app, hay que
 * volver a autorizar cada vez que se quiera subir algo. Pasó el 15/10/2026:
 * los dos reels de Stellest no se pudieron subir por eso.
 *
 * Es el mismo flujo que scripts/ads/oauth_google.js, con otro scope y otras
 * credenciales: las de YouTube son de un proyecto PROPIO, separado del de
 * Ads — no se mezclan. Imprime una URL; la persona la abre con la cuenta de
 * Google dueña del canal, acepta, y el token aparece en la terminal. No escribe
 * archivos ni loguea secretos.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const CLIENT_ID = process.env.GOOGLE_YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_YOUTUBE_CLIENT_SECRET;
const PORT = 8086;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth`;
// upload alcanza para subir; youtube.readonly para que el script pueda leer
// el status real del video después de subirlo.
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Faltan GOOGLE_YOUTUBE_CLIENT_ID y/o GOOGLE_YOUTUBE_CLIENT_SECRET en .env.');
    process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', state);

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname !== '/oauth') { res.writeHead(404).end(); return; }
    if (url.searchParams.get('state') !== state) {
        res.writeHead(400).end('state inválido — cerrá esta pestaña y volvé a correr el script.');
        return;
    }
    const error = url.searchParams.get('error');
    if (error) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Autorización rechazada: ${error}. Podés cerrar esta pestaña.`);
        console.error(`\nGoogle devolvió error: ${error}`);
        server.close(); process.exit(1);
    }
    const code = url.searchParams.get('code');
    if (!code) { res.writeHead(400).end('Falta el código.'); return; }
    try {
        const body = new URLSearchParams({
            code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT, grant_type: 'authorization_code',
        });
        const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
        const json = await r.json();
        if (!json.refresh_token) {
            throw new Error(`Sin refresh_token en la respuesta: ${JSON.stringify({ ...json, access_token: '***' })}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            .end('Listo ✔ — el token quedó en la terminal. Podés cerrar esta pestaña.');
        console.log('\n✔ Autorización correcta. Reemplazar esta línea en .env (NO commitearlo):\n');
        console.log(`GOOGLE_YOUTUBE_REFRESH_TOKEN=${json.refresh_token}\n`);
        console.log('Después subir con:');
        console.log('  node scripts/social/subir-youtube.mjs lente-stellest');
        console.log('  node scripts/social/subir-youtube.mjs stellest-frena-miopia');
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Falló el canje del código: ${e.message}`);
        console.error(`\nFalló el canje: ${e.message}`);
    } finally {
        server.close(); process.exit(0);
    }
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('1. Abrir esta URL con la cuenta de Google dueña del canal de YouTube:\n');
    console.log(authUrl.toString());
    console.log('\n2. Iniciar sesión y aceptar. El script termina solo.\n');
});
