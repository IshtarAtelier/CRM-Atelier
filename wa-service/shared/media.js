'use strict';

const { withTimeout } = require('../utils');

// ─────────────────────────────────────────────────────────────────────────────
// Bajada y guardado del archivo adjunto de un mensaje de WhatsApp.
//
// Por qué existe: la foto que manda el cliente es, muchas veces, LA RECETA. Y
// se perdía. De 721 imágenes recibidas, 396 quedaron sin archivo (55%): abril
// 1% de éxito, mayo 28%, junio 87%. Fue mejorando, pero el 13% que todavía
// falla son recetas que el cliente ya mandó y hay que volver a pedirle.
//
// El problema no era el diagnóstico sino la falta de red de contención: la
// bajada y la subida iban a un intento único, sin timeout ni reintento. Un
// tirón de red y la foto se perdía PARA SIEMPRE, porque WhatsApp borra el
// archivo de sus servidores al poco tiempo y después ya no se puede recuperar.
//
// Vive acá y no en index.js porque los dos caminos que reciben archivos
// (mensajes entrantes y salientes) hacían lo mismo copiado dos veces.
// ─────────────────────────────────────────────────────────────────────────────

/** Una bajada puede tardar en una foto pesada con red lenta; más que esto es que colgó. */
const DOWNLOAD_TIMEOUT_MS = 45_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
/** Espera entre intentos. Creciente: si WhatsApp está tildado, insistir al toque no ayuda. */
const BACKOFF_MS = [0, 1_500, 4_000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Baja el archivo de un mensaje, con timeout y reintentos.
 * Devuelve el objeto media de whatsapp-web.js, o null si no se pudo.
 */
async function downloadMediaWithRetry(msg, label = 'media') {
    for (let intento = 0; intento < ATTEMPTS; intento++) {
        if (BACKOFF_MS[intento]) await sleep(BACKOFF_MS[intento]);
        try {
            const media = await withTimeout(
                msg.downloadMedia(),
                DOWNLOAD_TIMEOUT_MS,
                `Timeout bajando ${label}`,
            );
            // downloadMedia() resuelve con undefined cuando el archivo ya no está
            // en los servidores de WhatsApp: reintentar no lo va a traer.
            if (!media || !media.data) {
                console.warn(`  ⚠️ [media] ${label}: WhatsApp no devolvió el archivo (ya no está disponible).`);
                return null;
            }
            if (intento > 0) console.log(`  ✅ [media] ${label} bajada en el intento ${intento + 1}.`);
            return media;
        } catch (e) {
            const ultimo = intento === ATTEMPTS - 1;
            console.error(
                `  ${ultimo ? '❌' : '↻'} [media] ${label}: falló la bajada (intento ${intento + 1}/${ATTEMPTS}): ${e.message}`,
            );
            if (ultimo) return null;
        }
    }
    return null;
}

/**
 * Sube el archivo al CRM y devuelve su URL pública, o null si no se pudo.
 * Con timeout y reintentos por el mismo motivo que la bajada.
 */
async function uploadMediaToCrm(buffer, mimetype, filename, label = 'media') {
    const axios = require('axios');
    const FormDataNode = require('form-data');

    let uploadUrl = process.env.CRM_API_URL || '';
    if (uploadUrl.endsWith('/api/bot')) uploadUrl = uploadUrl.replace('/api/bot', '/api/upload');
    else if (uploadUrl.endsWith('/api')) uploadUrl = uploadUrl + '/upload';
    else uploadUrl = uploadUrl + '/upload';

    for (let intento = 0; intento < ATTEMPTS; intento++) {
        if (BACKOFF_MS[intento]) await sleep(BACKOFF_MS[intento]);
        try {
            // El form se arma en cada intento: un stream ya consumido no se puede reenviar.
            const form = new FormDataNode();
            form.append('file', buffer, { filename, contentType: mimetype });

            const res = await axios.post(uploadUrl, form, {
                headers: { ...form.getHeaders(), 'x-api-key': process.env.BOT_API_KEY },
                timeout: UPLOAD_TIMEOUT_MS,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
            if (res.data && res.data.url) {
                if (intento > 0) console.log(`  ✅ [media] ${label} subida en el intento ${intento + 1}.`);
                return res.data.url;
            }
            console.warn(`  ⚠️ [media] ${label}: el CRM respondió sin url.`);
        } catch (e) {
            const ultimo = intento === ATTEMPTS - 1;
            console.error(
                `  ${ultimo ? '❌' : '↻'} [media] ${label}: falló la subida al CRM (intento ${intento + 1}/${ATTEMPTS}): ${e.message}`,
            );
        }
    }
    // Si llegamos acá el archivo se perdió: dejar constancia explícita, porque
    // el mensaje se va a guardar igual y en el buzón se ve como "sin archivo".
    console.error(`  ❌ [media] ${label}: SE PIERDE el archivo — el mensaje queda sin adjunto.`);
    return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// ¿Meta va a poder descargar esta foto?
//
// La Cloud API no recibe los bytes: recibe una URL y la descarga ELLA. Si esa
// descarga falla, Meta rechaza el MENSAJE ENTERO — no manda la foto sin el
// texto, no manda nada. El caption se pierde con la imagen.
//
// El 5/9/26 el bot le mandó a una clienta la dirección, el horario y el link
// del mapa como caption de la foto de la fachada. La foto
// (`agent_fachada.jpg`) daba 404, así que Meta descartó todo: la clienta nunca
// recibió la dirección. Las fotos `agent_*` viven en `storage/uploads`, el
// disco del contenedor, que Railway borra en cada deploy — se van a volver a
// morir. Las del catálogo (`/images/products/…`, commiteadas) están bien.
//
// Por eso, antes de mandar, se comprueba que la URL responda. Si no responde,
// el turno sigue con el TEXTO SOLO: el cliente se queda sin la foto, nunca sin
// la dirección.
// ─────────────────────────────────────────────────────────────────────────────

/** Chequear la misma URL en cada mensaje es plata y latencia al pedo. */
const CACHE_MEDIA_TTL_MS = 10 * 60 * 1000;
const cacheMedia = new Map(); // url → { ok, ts }
const MEDIA_CHECK_TIMEOUT_MS = 6_000;

/**
 * `true` si la URL sirve una imagen que Meta puede bajar. Ante la duda (timeout,
 * red caída) devuelve `true`: perder una foto por un chequeo nervioso es peor
 * que intentarla — lo que se corta acá son los 404 y 403 seguros.
 */
async function mediaDescargable(url) {
    if (!url || !/^https?:\/\//i.test(url)) return false;

    const cacheado = cacheMedia.get(url);
    if (cacheado && Date.now() - cacheado.ts < CACHE_MEDIA_TTL_MS) return cacheado.ok;

    let ok = true;
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), MEDIA_CHECK_TIMEOUT_MS);
        try {
            // HEAD primero; hay servidores que no lo implementan y contestan 405.
            let r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
            if (r.status === 405 || r.status === 501) {
                r = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
            }
            // Solo un rechazo CLARO del servidor descarta la foto.
            if (r.status >= 400 && r.status < 500) ok = false;
        } finally {
            clearTimeout(t);
        }
    } catch {
        ok = true; // timeout o red: se intenta igual
    }

    cacheMedia.set(url, { ok, ts: Date.now() });
    if (!ok) console.warn(`[Media] La URL no se puede descargar, se manda el texto solo: ${String(url).slice(0, 110)}`);
    return ok;
}


/**
 * La foto de la fachada que manda el bot.
 *
 * Vive en `public/` (commiteada en el repo del CRM), NO en `storage/uploads`.
 * Esa diferencia es el bug: `storage/uploads` es el disco del contenedor y
 * Railway lo borra en cada deploy, así que la vieja
 * (`/api/storage/view?key=agent_fachada.jpg`) daba 404 y Meta rechazaba el
 * mensaje entero — dirección, horario y mapa incluidos. Cualquier foto FIJA que
 * mande el bot tiene que salir de `public/`, como las del catálogo.
 */
const FOTO_FACHADA_URL = 'https://atelieroptica.com.ar/images/blog/fachada-ladrillo.jpg';

module.exports = { downloadMediaWithRetry, uploadMediaToCrm, mediaDescargable, FOTO_FACHADA_URL };
