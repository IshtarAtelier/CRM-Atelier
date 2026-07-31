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

module.exports = { downloadMediaWithRetry, uploadMediaToCrm };
