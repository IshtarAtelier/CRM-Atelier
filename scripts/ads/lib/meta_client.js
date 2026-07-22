/**
 * Cliente compartido para la Meta Marketing API (Graph API).
 *
 * Único punto de salida a graph.facebook.com de todos los scripts de ads
 * (ver scripts/ads/CLAUDE.md). Concentra las protecciones:
 *  - versión de API pineada
 *  - appsecret_proof (si hay META_APP_SECRET)
 *  - serialización de llamadas con intervalo mínimo (sin paralelismo)
 *  - backoff exponencial con jitter para errores transitorios
 *  - clasificación de errores (368 = parar todo, 190 = token, rate limits)
 *  - monitoreo de cuota vía headers de uso (aviso al 70%)
 *  - log de auditoría en meta_api.log, siempre sin el token
 *  - escritura bloqueada salvo confirmación explícita + env dedicada
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const LOG_FILE = path.join(__dirname, '..', 'meta_api.log');
const MIN_GAP_MS = Number(process.env.META_MIN_CALL_GAP_MS || 1500);
const MAX_ATTEMPTS = 3;

// Códigos que ameritan reintento con backoff (transitorios / rate limits).
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613, 80000, 80004]);

class MetaApiError extends Error {
  /**
   * @param {string} message
   * @param {{code?: number, subcode?: number, fatal?: boolean, guidance?: string}} info
   */
  constructor(message, info = {}) {
    super(message);
    this.name = 'MetaApiError';
    this.code = info.code;
    this.subcode = info.subcode;
    this.fatal = Boolean(info.fatal);
    this.guidance = info.guidance || '';
  }
}

function readToken() {
  const t = process.env.META_ADS_TOKEN;
  if (!t) {
    throw new MetaApiError('Falta META_ADS_TOKEN en el entorno.', {
      fatal: true,
      guidance: 'Cargar el token de lectura (ads_read) en .env como META_ADS_TOKEN.',
    });
  }
  return t;
}

function writeToken() {
  const t = process.env.META_ADS_WRITE_TOKEN;
  if (!t) {
    throw new MetaApiError('Falta META_ADS_WRITE_TOKEN: la escritura usa un token dedicado.', {
      fatal: true,
      guidance: 'Generar un token con ads_management y cargarlo como META_ADS_WRITE_TOKEN.',
    });
  }
  return t;
}

/** appsecret_proof oficial: HMAC-SHA256 del token, keyed por el app secret. */
function appsecretProof(token) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

/** Borra cualquier secreto de un string antes de loguearlo o mostrarlo. */
function redact(text) {
  let out = String(text ?? '');
  for (const t of [process.env.META_ADS_TOKEN, process.env.META_ADS_WRITE_TOKEN, process.env.META_APP_SECRET]) {
    if (t) out = out.split(t).join('***');
  }
  return out.replace(/access_token=[^&\s"']+/gi, 'access_token=***');
}

function logLine(endpoint, acct, outcome, note) {
  const line = `${new Date().toISOString()} | ${endpoint} | acct=${acct || '-'} | ${outcome} | ${redact(note || '')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    /* el log nunca rompe la llamada */
  }
}

function acctFromPath(apiPath) {
  const m = String(apiPath).match(/act_\d+/);
  return m ? m[0] : null;
}

/** Aviso si algún medidor de cuota de los headers de uso supera el 70%. */
function checkUsageHeaders(res, endpoint) {
  for (const header of ['x-business-use-case-usage', 'x-app-usage', 'x-ad-account-usage']) {
    const raw = res.headers.get(header);
    if (!raw) continue;
    try {
      const usage = JSON.parse(raw);
      const meters = [];
      (function collect(node) {
        if (Array.isArray(node)) return node.forEach(collect);
        if (node && typeof node === 'object') {
          for (const [k, v] of Object.entries(node)) {
            if (typeof v === 'number' && /call_count|total_cputime|total_time|acc_id_util_pct/.test(k)) {
              meters.push(v);
            } else {
              collect(v);
            }
          }
        }
      })(usage);
      const max = Math.max(0, ...meters);
      if (max >= 70) {
        console.warn(`[meta_client] Cuota de API al ${max}% (${header}). Frenar antes de seguir.`);
        logLine(endpoint, null, 'warn=quota', `${header} al ${max}%`);
      }
    } catch {
      /* header no parseable: ignorar */
    }
  }
}

/** Clasifica el error de Graph y devuelve el MetaApiError correspondiente. */
function classifyError(err, endpoint) {
  const code = Number(err.code);
  const subcode = err.error_subcode ? Number(err.error_subcode) : undefined;
  const msg = redact(err.message || 'Error de Meta API');

  if (code === 368) {
    return new MetaApiError(`Meta bloqueó la operación por políticas (368): ${msg}`, {
      code,
      subcode,
      fatal: true,
      guidance:
        'PARAR TODO. No reintentar, no regenerar el token, no volver a llamar a la API. ' +
        'Revisar el aviso en Business Manager y meta_api.log antes de cualquier paso.',
    });
  }
  if (code === 190) {
    return new MetaApiError(`Token inválido o expirado (190): ${msg}`, {
      code,
      subcode,
      fatal: true,
      guidance: 'Pedir al usuario un token nuevo. No reintentar con el mismo.',
    });
  }
  if (code === 10 || (code >= 200 && code <= 299)) {
    return new MetaApiError(`El token no tiene permisos para esto (${code}): ${msg}`, {
      code,
      subcode,
      fatal: true,
      guidance: 'Regenerar el token con los scopes correctos (ads_read / ads_management).',
    });
  }
  if (TRANSIENT_CODES.has(code)) {
    return new MetaApiError(`Rate limit / error transitorio de Meta (${code}): ${msg}`, {
      code,
      subcode,
      guidance: 'Si persiste tras los reintentos, esperar 5+ minutos antes de volver a intentar.',
    });
  }
  return new MetaApiError(`Meta API error ${code}: ${msg}`, { code, subcode });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cola que serializa TODAS las llamadas del proceso con un intervalo mínimo.
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
  chain = run.catch(() => {}); // un error no rompe la cola para la próxima llamada
  return run;
}

/**
 * Núcleo: una llamada HTTP a Graph con reintentos para errores transitorios.
 * No usar directo — entrar por get()/getAllPages()/post().
 *
 * Las ESCRITURAS jamás se reintentan: un error ambiguo (corte de red después
 * de enviar el POST, error 1/2 de Graph) puede significar que Meta YA aplicó
 * el cambio — reintentar crearía una campaña/ajuste duplicado que gasta plata.
 */
async function request(method, apiPath, params = {}, { token } = {}) {
  const tok = token || readToken();
  const endpoint = `${method} ${apiPath}`;
  const acct = acctFromPath(apiPath);
  const canRetry = method === 'GET';
  const maxAttempts = canRetry ? MAX_ATTEMPTS : 1;
  const writeGuidance =
    'La escritura pudo haberse aplicado igual: VERIFICAR en el Ads Manager antes de reintentar nada.';

  return enqueue(async () => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        const backoff = 2000 * 2 ** (attempt - 2) + Math.floor(Math.random() * 1000);
        await sleep(backoff);
      }
      try {
        const url = new URL(`${BASE}/${apiPath.replace(/^\//, '')}`);
        const body = new URLSearchParams();
        const target = method === 'GET' ? url.searchParams : body;
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null) target.set(k, String(v));
        }
        target.set('access_token', tok);
        const proof = appsecretProof(tok);
        if (proof) target.set('appsecret_proof', proof);

        const res = await fetch(url, {
          method,
          ...(method === 'GET' ? {} : { body }),
        });
        checkUsageHeaders(res, endpoint);
        const json = await res.json();

        if (json.error) {
          const classified = classifyError(json.error, endpoint);
          if (!canRetry) classified.guidance = `${classified.guidance} ${writeGuidance}`.trim();
          logLine(endpoint, acct, `error=${classified.code ?? '?'}`, classified.message);
          const transient = TRANSIENT_CODES.has(Number(classified.code));
          if (classified.fatal || !transient || !canRetry) throw classified;
          lastError = classified; // transitorio y es un GET: reintentar
          continue;
        }

        logLine(endpoint, acct, 'ok', `intento=${attempt}`);
        return json;
      } catch (err) {
        if (err instanceof MetaApiError) {
          const transient = TRANSIENT_CODES.has(Number(err.code));
          if (err.fatal || !transient || !canRetry) throw err;
          lastError = err;
          continue;
        }
        // Error de red: ambiguo para una escritura (pudo haberse aplicado igual).
        const networkErr = new MetaApiError(`Error de red llamando a Meta: ${redact(err.message)}`, {
          fatal: !canRetry,
          guidance: canRetry ? '' : writeGuidance,
        });
        logLine(endpoint, acct, 'error=network', err.message);
        if (!canRetry) throw networkErr;
        lastError = networkErr;
      }
    }
    throw lastError || new MetaApiError('Meta API: agotados los reintentos.', {});
  });
}

/**
 * GET de lectura (usa META_ADS_TOKEN por default).
 * @param {string} overrideToken  Uso interno (ver debugToken()) — normalmente no hace falta.
 */
function get(apiPath, params = {}, overrideToken) {
  return request('GET', apiPath, params, { token: overrideToken });
}

/**
 * debug_token requiere un app access token (o el token de un admin/developer
 * de la app) como access_token — el propio token de lectura/sistema a veces
 * no califica (p.ej. un token válido de alguien que no es developer de la
 * app). Si hay META_APP_ID + META_APP_SECRET, usamos el app token estándar
 * `app_id|app_secret`; si no, autoinspeccionamos con el mismo token (funciona
 * en el caso típico: system user del Business dueño de la app).
 */
async function debugToken(inputToken) {
  const { META_APP_ID, META_APP_SECRET } = process.env;
  const appToken = META_APP_ID && META_APP_SECRET ? `${META_APP_ID}|${META_APP_SECRET}` : null;
  return request('GET', 'debug_token', { input_token: inputToken }, { token: appToken || inputToken });
}

/**
 * GET paginado: sigue el cursor `after` hasta agotar o llegar a maxPages.
 * Devuelve la lista concatenada de `data`. Si corta por falta de cursor con
 * `paging.next` aún presente, o por alcanzar maxPages con más páginas
 * disponibles, avisa por stderr — nunca trunca en silencio.
 */
async function getAllPages(apiPath, params = {}, maxPages = 20) {
  const all = [];
  let after;
  for (let page = 0; page < maxPages; page++) {
    const json = await get(apiPath, after ? { ...params, after } : params);
    if (Array.isArray(json.data)) all.push(...json.data);
    after = json.paging?.cursors?.after;
    if (json.paging?.next && !after) {
      console.warn(`[meta_client] ${apiPath}: hay más páginas (paging.next) pero sin cursor 'after' — resultado incompleto.`);
      break;
    }
    if (!json.paging?.next) break;
    if (page === maxPages - 1) {
      console.warn(`[meta_client] ${apiPath}: se alcanzó el límite de ${maxPages} páginas con más datos disponibles — resultado incompleto.`);
    }
  }
  return all;
}

/**
 * Escritura (POST). Bloqueada por triple llave:
 *  1. opts.confirm === true — el llamador declara que el usuario confirmó
 *     esta operación puntual en la conversación.
 *  2. META_ALLOW_WRITES=1 en el entorno.
 *  3. META_ADS_WRITE_TOKEN presente (el token de lectura nunca escribe).
 */
function post(apiPath, params = {}, opts = {}) {
  if (opts.confirm !== true) {
    throw new MetaApiError('Escritura rechazada: falta la confirmación explícita del usuario.', {
      fatal: true,
      guidance: 'Mostrar el cambio exacto al usuario, esperar su OK y pasar {confirm: true}.',
    });
  }
  if (process.env.META_ALLOW_WRITES !== '1') {
    throw new MetaApiError('Escritura rechazada: META_ALLOW_WRITES no está habilitado.', {
      fatal: true,
      guidance: 'Exportar META_ALLOW_WRITES=1 solo para la operación confirmada.',
    });
  }
  return request('POST', apiPath, params, { token: writeToken() });
}

/** Normaliza el id de cuenta al formato act_XXXX. */
function accountId() {
  const raw = process.env.META_AD_ACCOUNT_ID;
  if (!raw) {
    throw new MetaApiError('Falta META_AD_ACCOUNT_ID en el entorno.', {
      fatal: true,
      guidance: 'Cargar el id de la cuenta publicitaria (formato act_XXXXXXXXX) en .env.',
    });
  }
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

module.exports = {
  API_VERSION,
  MetaApiError,
  get,
  getAllPages,
  post,
  debugToken,
  accountId,
  redact,
};
