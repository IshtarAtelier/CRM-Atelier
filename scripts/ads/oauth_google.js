#!/usr/bin/env node
/**
 * Genera el GOOGLE_ADS_REFRESH_TOKEN para la API de Google Ads (se corre UNA vez).
 *
 * Requiere en el entorno (ver scripts/ads/CLAUDE.md):
 *   GOOGLE_ADS_CLIENT_ID       OAuth Client tipo "Aplicación de escritorio"
 *   GOOGLE_ADS_CLIENT_SECRET   su secret
 *
 * Uso:
 *   node --env-file=.env scripts/ads/oauth_google.js
 *
 * Imprime una URL, la persona con acceso de EDICIÓN a la cuenta de Ads la abre,
 * inicia sesión y acepta. El script captura el código en localhost, lo canjea
 * y muestra el refresh token para pegar en .env. No escribe archivos ni loguea
 * secretos en ningún lado.
 */

const http = require('http');
const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const PORT = 8085;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GOOGLE_ADS_CLIENT_ID y/o GOOGLE_ADS_CLIENT_SECRET en .env.');
  console.error('Crearlos en Google Cloud Console → APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth → tipo "Aplicación de escritorio".');
  process.exit(1);
}

// state anti-CSRF: solo aceptamos el callback de ESTA corrida.
const state = crypto.randomBytes(16).toString('hex');

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline'); // sin esto no hay refresh token
authUrl.searchParams.set('prompt', 'consent');      // fuerza refresh token aunque ya se haya autorizado antes
authUrl.searchParams.set('state', state);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== '/oauth') {
    res.writeHead(404).end();
    return;
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400).end('state inválido — cerrá esta pestaña y volvé a correr el script.');
    return;
  }
  const error = url.searchParams.get('error');
  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Autorización rechazada: ${error}. Podés cerrar esta pestaña.`);
    console.error(`\nGoogle devolvió error: ${error}`);
    server.close();
    process.exit(1);
  }
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Falta el código.');
    return;
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    });
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
    const json = await r.json();
    if (!json.refresh_token) {
      throw new Error(`Sin refresh_token en la respuesta: ${JSON.stringify({ ...json, access_token: '***' })}`);
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('Listo ✔ — el token quedó en la terminal. Podés cerrar esta pestaña.');
    console.log('\n✔ Autorización correcta. Agregar esta línea a .env (NO commitearlo):\n');
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${json.refresh_token}\n`);
    console.log('Después verificar acceso de lectura con:');
    console.log('  node --env-file=.env scripts/ads/google_report.js');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`Falló el canje del código: ${e.message}`);
    console.error(`\nFalló el canje: ${e.message}`);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('1. Abrir esta URL en el navegador (con la cuenta de Google que tiene acceso de EDICIÓN a la cuenta de Ads):\n');
  console.log(authUrl.toString());
  console.log('\n2. Iniciar sesión y aceptar. El script termina solo.\n');
});
