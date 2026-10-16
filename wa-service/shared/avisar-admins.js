'use strict';

/**
 * Aviso de un FALLO del wa-service al canal "🔧 Fallos y salud del sistema"
 * de la mensajería interna, vía el CRM (/api/bot/aviso-sistema →
 * avisarAdmins()). Regla del 8/10/2026: los fallos de robots van a la
 * mensajería, no al mail (notifyAdminDown sigue siendo mail).
 *
 * Nunca lanza: un aviso roto no puede frenar al bot. El CRM deduplica 20 h
 * por `dedupePrefijo`; igual, quien lo llama avisa UNA vez por episodio.
 */
async function avisarAdmins({ asunto, cuerpo, urgente = false, dedupePrefijo } = {}, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
    try {
        const base = (env.CRM_API_URL || '').replace(/\/+$/, '');
        if (!base || !fetchImpl) return false;
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15000);
        try {
            const r = await fetchImpl(`${base}/aviso-sistema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': env.BOT_API_KEY || '' },
                body: JSON.stringify({ asunto, cuerpo, urgente, dedupePrefijo }),
                signal: controller.signal,
            });
            return Boolean(r && r.ok);
        } finally {
            clearTimeout(t);
        }
    } catch (e) {
        console.error('[AvisarAdmins] No se pudo avisar al canal del sistema:', e && e.message);
        return false;
    }
}

module.exports = { avisarAdmins };
