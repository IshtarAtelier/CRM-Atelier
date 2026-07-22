/**
 * Cliente compartido para Google Ads API (REST v17).
 *
 * Espejo intencional de meta_client.js: mismas garantías (serialización,
 * backoff, protocolo de errores, logging sin secretos, escritura con triple
 * llave), mismo formato de meta_api.log — así un reporte cruzado Meta+Google
 * puede tratar ambos igual. Ver scripts/ads/CLAUDE.md.
 *
 * NO IMPLEMENTADO TODAVÍA: requiere el developer token de Google Ads
 * (pendiente de aprobación — ver memoria del proyecto). El esqueleto queda
 * listo para no rediseñar nada cuando el token llegue.
 */

const fs = require('fs');
const path = require('path');

const API_VERSION = 'v17';
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const LOG_FILE = path.join(__dirname, '..', 'meta_api.log'); // log compartido, mismo formato

class GoogleAdsApiError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = 'GoogleAdsApiError';
    this.code = info.code;
    this.fatal = Boolean(info.fatal);
    this.guidance = info.guidance || '';
  }
}

function redact(text) {
  let out = String(text ?? '');
  for (const t of [
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
    process.env.GOOGLE_ADS_REFRESH_TOKEN,
  ]) {
    if (t) out = out.split(t).join('***');
  }
  return out.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}

function logLine(endpoint, acct, outcome, note) {
  const line = `${new Date().toISOString()} | google:${endpoint} | acct=${acct || '-'} | ${outcome} | ${redact(note || '')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* el log nunca rompe la llamada */
  }
}

function requireEnv() {
  const missing = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN'].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    throw new GoogleAdsApiError(`Faltan variables de Google Ads: ${missing.join(', ')}`, {
      fatal: true,
      guidance: 'Completar credenciales OAuth + developer token en .env antes de usar este cliente.',
    });
  }
}

/**
 * Placeholder: intercambia el refresh token por un access token de OAuth.
 * TODO cuando llegue el developer token: implementar el POST a
 * https://oauth2.googleapis.com/token con client_id/client_secret/refresh_token.
 */
async function getAccessToken() {
  requireEnv();
  throw new GoogleAdsApiError('Cliente de Google Ads aún no implementado (falta developer token aprobado).', {
    fatal: true,
    guidance: 'Ver memoria del proyecto: pendiente developer token del MCC. No usar este cliente todavía.',
  });
}

/** Escritura: misma triple llave que Meta (confirm + env dedicada + credencial de escritura). */
function assertWriteAllowed(opts = {}) {
  if (opts.confirm !== true) {
    throw new GoogleAdsApiError('Escritura rechazada: falta la confirmación explícita del usuario.', { fatal: true });
  }
  if (process.env.GOOGLE_ADS_ALLOW_WRITES !== '1') {
    throw new GoogleAdsApiError('Escritura rechazada: GOOGLE_ADS_ALLOW_WRITES no está habilitado.', { fatal: true });
  }
}

module.exports = {
  API_VERSION,
  BASE,
  GoogleAdsApiError,
  getAccessToken,
  assertWriteAllowed,
  redact,
  logLine,
};
