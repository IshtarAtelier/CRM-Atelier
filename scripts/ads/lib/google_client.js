/**
 * Cliente compartido para Google Ads API (REST).
 *
 * Espejo intencional de meta_client.js: mismas garantías (serialización con
 * intervalo mínimo, backoff con jitter SOLO en lecturas, protocolo de errores,
 * logging sin secretos, escritura con llaves explícitas) y mismo formato de
 * log en meta_api.log — así los reportes cruzados Meta+Google tratan ambos
 * lados igual. Ver scripts/ads/CLAUDE.md.
 *
 * Env vars requeridas (solo en .env, jamás hardcodeadas):
 *   GOOGLE_ADS_DEVELOPER_TOKEN   developer token del MCC (acceso Basic)
 *   GOOGLE_ADS_CLIENT_ID         OAuth client id (Google Cloud)
 *   GOOGLE_ADS_CLIENT_SECRET     OAuth client secret
 *   GOOGLE_ADS_REFRESH_TOKEN     refresh token del usuario autorizado
 *   GOOGLE_ADS_CUSTOMER_ID       cuenta a operar (con o sin guiones)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID opcional: id del MCC si el acceso es vía manager
 *   GOOGLE_ADS_ALLOW_WRITES=1    solo inline, para una mutación confirmada
 */

const fs = require('fs');
const path = require('path');

// v24: última major viva a jul-2026 (Google sunsetea cada ~1 año; v21 muere 5/8/2026).
const API_VERSION = 'v24';
const BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const LOG_FILE = path.join(__dirname, '..', 'meta_api.log'); // log compartido, mismo formato
const MIN_GAP_MS = Number(process.env.ADS_MIN_CALL_GAP_MS || 1500);
const MAX_ATTEMPTS = 3;

class GoogleAdsApiError extends Error {
  constructor(message, info = {}) {
    super(message);
    this.name = 'GoogleAdsApiError';
    this.status = info.status;
    this.fatal = Boolean(info.fatal);
    this.guidance = info.guidance || '';
  }
}

// Access token cacheado en memoria del proceso (dura ~1h; margen de 60s).
let cachedAccessToken = null; // { token, expiresAt }

function redact(text) {
  let out = String(text ?? '');
  for (const t of [
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
    process.env.GOOGLE_ADS_REFRESH_TOKEN,
    cachedAccessToken?.token,
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
  const missing = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new GoogleAdsApiError(`Faltan variables de Google Ads: ${missing.join(', ')}`, {
      fatal: true,
      guidance: 'Completar credenciales OAuth + developer token en .env antes de usar este cliente.',
    });
  }
}

/** Id de cuenta normalizado (Google acepta con o sin guiones; la API los quiere sin). */
function customerId() {
  const raw = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!raw) {
    throw new GoogleAdsApiError('Falta GOOGLE_ADS_CUSTOMER_ID en el entorno.', {
      fatal: true,
      guidance: 'Cargar el id de la cuenta de Google Ads (formato 123-456-7890 o 1234567890).',
    });
  }
  return raw.replace(/-/g, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cola que serializa TODAS las llamadas del proceso (sin paralelismo, como Meta).
let chain = Promise.resolve();
let lastCallAt = 0;

function enqueue(fn) {
  const run = chain.then(async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastCallAt = Date.now();
    }
  });
  chain = run.catch(() => {});
  return run;
}

async function getAccessToken() {
  requireEnv();
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    logLine('oauth/token', null, `error=${res.status}`, json.error_description || json.error || 'sin detalle');
    // Un 5xx/429 del endpoint OAuth es transitorio: dejarlo retryable para que
    // el loop de call() lo reintente. Solo 4xx (invalid_grant etc.) es fatal.
    const transient = res.status >= 500 || res.status === 429;
    throw new GoogleAdsApiError(
      `No se pudo renovar el access token de Google (${res.status}): ${redact(json.error_description || json.error || '')}`,
      {
        status: res.status,
        fatal: !transient,
        guidance: transient
          ? 'Error transitorio del servidor de OAuth de Google.'
          : 'El refresh token puede estar revocado o mal copiado. Regenerarlo con la misma cuenta que administra Google Ads.',
      },
    );
  }
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  return cachedAccessToken.token;
}

/** Clasifica una respuesta de error de la Google Ads API. */
function classifyError(status, body) {
  const detail = redact(body?.error?.message || JSON.stringify(body?.error?.details || body || {}).slice(0, 400));
  if (status === 401) {
    cachedAccessToken = null; // forzar renovación en el próximo intento
    return new GoogleAdsApiError(`Google Ads: no autorizado (401): ${detail}`, {
      status,
      guidance: 'Access token vencido o inválido — el cliente lo renueva solo; si persiste, revisar el refresh token.',
    });
  }
  if (status === 403) {
    return new GoogleAdsApiError(`Google Ads: acceso denegado (403): ${detail}`, {
      status,
      fatal: true,
      guidance:
        'Típico: developer token sin aprobar para esta cuenta (pedir acceso Basic en el Centro de API del MCC), ' +
        'login-customer-id faltante cuando el acceso es vía manager, o la cuenta no está vinculada al MCC.',
    });
  }
  if (status === 429) {
    return new GoogleAdsApiError(`Google Ads: cuota excedida (429): ${detail}`, {
      status,
      guidance: 'Esperar unos minutos antes de reintentar. Con acceso Basic la cuota diaria es de 15.000 operaciones.',
    });
  }
  if (status >= 500) {
    return new GoogleAdsApiError(`Google Ads: error del servidor (${status}): ${detail}`, { status });
  }
  return new GoogleAdsApiError(`Google Ads API error ${status}: ${detail}`, { status, fatal: status === 400 });
}

const RETRYABLE_STATUS = new Set([401, 429, 500, 502, 503, 504]);

/**
 * Núcleo HTTP. Las MUTACIONES (isMutation) jamás se reintentan: un error
 * ambiguo puede significar que Google ya aplicó el cambio (misma regla que
 * las escrituras de Meta — evita presupuestos/campañas duplicados).
 * El 401 es retryable SOLO en lecturas: classifyError limpia el cache y el
 * reintento renueva el access token.
 */
async function call(endpoint, payload, { isMutation = false } = {}) {
  const cid = customerId();
  const maxAttempts = isMutation ? 1 : MAX_ATTEMPTS;

  return enqueue(async () => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) await sleep(2000 * 2 ** (attempt - 2) + Math.floor(Math.random() * 1000));
      try {
        const token = await getAccessToken();
        const headers = {
          Authorization: `Bearer ${token}`,
          'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        };
        if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
          headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
        }
        const res = await fetch(`${BASE}/customers/${cid}/${endpoint}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          const classified = classifyError(res.status, json);
          logLine(endpoint, cid, `error=${res.status}`, classified.message);
          if (classified.fatal || !RETRYABLE_STATUS.has(res.status) || isMutation) throw classified;
          lastError = classified;
          continue;
        }

        logLine(endpoint, cid, 'ok', `intento=${attempt}`);
        return json;
      } catch (err) {
        if (err instanceof GoogleAdsApiError) {
          if (err.fatal || !RETRYABLE_STATUS.has(err.status) || isMutation) throw err;
          lastError = err;
          continue;
        }
        const networkErr = new GoogleAdsApiError(`Error de red llamando a Google Ads: ${redact(err.message)}`, {
          fatal: isMutation,
          guidance: isMutation
            ? 'La mutación pudo haberse aplicado igual: VERIFICAR en Google Ads antes de reintentar nada.'
            : '',
        });
        logLine(endpoint, cid, 'error=network', err.message);
        if (isMutation) throw networkErr;
        lastError = networkErr;
      }
    }
    throw lastError || new GoogleAdsApiError('Google Ads API: agotados los reintentos.', {});
  });
}

/**
 * Consulta GAQL de LECTURA, paginada completa (googleAds:search).
 * Devuelve la lista concatenada de `results`. Avisa si trunca por maxPages.
 */
async function search(gaqlQuery, maxPages = 20) {
  const all = [];
  let pageToken;
  for (let page = 0; page < maxPages; page++) {
    const json = await call('googleAds:search', {
      query: gaqlQuery,
      ...(pageToken ? { pageToken } : {}),
    });
    if (Array.isArray(json.results)) all.push(...json.results);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
    if (page === maxPages - 1) {
      console.warn(
        `[google_client] búsqueda: se alcanzó el límite de ${maxPages} páginas con más datos disponibles — resultado incompleto.`,
      );
    }
  }
  return all;
}

/**
 * Mutación (crear/editar campañas, presupuestos, estados). Doble llave, como
 * en Meta (acá no hay token de escritura separado — Google usa el mismo OAuth,
 * por eso el gate vive entero en el proceso):
 *  1. opts.confirm === true — el llamador declara que el usuario confirmó
 *     ESTA operación puntual en la conversación.
 *  2. GOOGLE_ADS_ALLOW_WRITES=1, pasado inline en el comando (nunca export).
 * Nunca se reintenta (ver call()).
 */
function mutate(endpoint, payload, opts = {}) {
  if (opts.confirm !== true) {
    throw new GoogleAdsApiError('Mutación rechazada: falta la confirmación explícita del usuario.', {
      fatal: true,
      guidance: 'Mostrar el cambio exacto al usuario, esperar su OK y pasar {confirm: true}.',
    });
  }
  if (process.env.GOOGLE_ADS_ALLOW_WRITES !== '1') {
    throw new GoogleAdsApiError('Mutación rechazada: GOOGLE_ADS_ALLOW_WRITES no está habilitado.', {
      fatal: true,
      guidance: 'Pasar GOOGLE_ADS_ALLOW_WRITES=1 inline en el comando, solo para la operación confirmada.',
    });
  }
  return call(endpoint, payload, { isMutation: true });
}

module.exports = {
  API_VERSION,
  GoogleAdsApiError,
  search,
  mutate,
  customerId,
  redact,
};
