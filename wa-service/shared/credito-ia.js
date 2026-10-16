'use strict';

/**
 * El bot frente a la IA sin crédito (pedido de Ishtar del 16/10/2026).
 *
 * El bot NO decide avisos ni deduplica: eso lo hace el CRM
 * (`src/services/ia-credito.service.ts`), que tiene el candado en la base y
 * manda el WhatsApp a la dueña. Acá solo:
 *  - se reporta cada falla de saldo al CRM (POST /api/bot/ia-credito), como
 *    mucho una vez cada REPORTE_MIN_MS por proceso para no martillar;
 *  - se recuerda desde cuándo este proceso está en un episodio, para que al
 *    volver el crédito se rescaten los chats que quedaron sin contestar;
 *  - se detecta la vuelta: una llamada que anduvo, o el CRM que cerró el
 *    episodio (SystemSetting `ia_sin_credito_desde` vacío; lo cierra la sonda
 *    de cada 30 min aunque nadie escriba).
 *
 * Nunca lanza: un aviso roto no puede frenar al bot.
 */

const CLAVE_EPISODIO = 'ia_sin_credito_desde';
// Un reporte por proceso cada 5 min alcanza: el CRM igual avisa una sola vez.
const REPORTE_MIN_MS = 5 * 60 * 1000;

async function reportarAlCrm(body, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
    try {
        const base = (env.CRM_API_URL || '').replace(/\/+$/, '');
        if (!base || !fetchImpl) return false;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        try {
            const r = await fetchImpl(`${base}/ia-credito`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': env.BOT_API_KEY || '' },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            return Boolean(r && r.ok);
        } finally {
            clearTimeout(t);
        }
    } catch (e) {
        console.error('[CreditoIA] No se pudo reportar al CRM:', e && e.message);
        return false;
    }
}

/**
 * @param {object} deps
 * @param {(body: object) => Promise<boolean>} [deps.reportar]
 * @param {(desde: Date) => Promise<void>} [deps.rescatar]  reprograma lo que quedó sin contestar
 * @param {(desde: Date) => Promise<boolean|null>} [deps.episodioAbiertoEnCrm]  false SOLO si el CRM
 *   cerró el episodio DESPUÉS de `desde` (si no, uno viejo cerrado lo daría por terminado); null = no se sabe
 * @param {() => number} [deps.reloj]
 */
function crearMonitorDeCredito({ reportar = reportarAlCrm, rescatar = async () => {}, episodioAbiertoEnCrm = async () => null, reloj = () => Date.now() } = {}) {
    let desde = null;          // ms: inicio del episodio visto por ESTE proceso
    let ultimoReporte = 0;

    async function falla(clase, { origen = 'bot de WhatsApp', detalle = '' } = {}) {
        if (desde == null) desde = reloj();
        const ahora = reloj();
        if (ahora - ultimoReporte < REPORTE_MIN_MS) return;
        ultimoReporte = ahora;
        await reportar({ estado: clase, origen, detalle: String(detalle || '').slice(0, 400) }).catch(() => false);
    }

    async function cerrar(motivo) {
        if (desde == null) return false;
        const inicio = desde;
        desde = null;
        ultimoReporte = 0;
        console.log(`  💳 [CreditoIA] Volvió la IA (${motivo}): se rescatan los chats que quedaron esperando desde ${new Date(inicio).toISOString()}.`);
        await rescatar(new Date(inicio)).catch(e => console.error('[CreditoIA] El rescate falló:', e && e.message));
        return true;
    }

    /** Una llamada a la IA anduvo. Si había episodio, se avisa al CRM y se rescata. */
    async function exito() {
        if (desde == null) return false;
        await reportar({ estado: 'ok', origen: 'bot de WhatsApp' }).catch(() => false);
        return cerrar('respondió el modelo');
    }

    /** Lo llama el poll de config: si el CRM ya cerró el episodio, se rescata. */
    async function revisar() {
        if (desde == null) return false;
        const abierto = await episodioAbiertoEnCrm(new Date(desde)).catch(() => null);
        if (abierto === false) return cerrar('el CRM cerró el episodio');
        return false;
    }

    return { falla, exito, revisar, enEpisodio: () => desde != null, desde: () => desde };
}

module.exports = { crearMonitorDeCredito, reportarAlCrm, CLAVE_EPISODIO, REPORTE_MIN_MS };
