/**
 * De lo que guarda `WhatsAppMessage.mediaUrl` a una URL que se puede bajar.
 *
 * ESPEJO de `resolveMediaUrl` (src/components/whatsapp/format.ts): el CRM
 * guarda el medio de cuatro formas —URL completa, ruta `/uploads/…`,
 * `local://clave` y, en producción con la nube prendida, la CLAVE PELADA
 * (`1789078202399_in_1789078202332`)— y las cuatro se sirven por
 * `/api/storage/view?key=`. El bot armaba `base + mediaUrl` y con la clave
 * pelada eso da `https://atelieroptica.com.ar1789078…` — un host que no
 * existe. Medido el 11/9/2026: 717 de 717 fotos entrantes de los últimos 60
 * días son clave pelada, o sea que el bot NUNCA pudo bajar una foto en
 * producción (ni el modelo ni el lector de recetas la vieron jamás). Los
 * arreglos del 10/9 (tipo por bytes, lector dedicado) eran necesarios pero
 * no alcanzaban: fallaba un paso antes.
 *
 * `scripts/checks/tipo-de-lente.check.mjs` prueba las cuatro formas contra
 * las dos copias.
 */

/** Origen del CRM sin `/api` ni `/api/bot`, sin barra final. */
function origenDelCrm(crmApiUrl = process.env.CRM_API_URL || '') {
    return String(crmApiUrl).replace(/\/+$/, '').replace(/\/api(\/bot)?$/, '');
}

/**
 * @param {string|null|undefined} mediaUrl lo guardado en WhatsAppMessage.mediaUrl
 * @param {string} [base] origen del CRM (por defecto sale de CRM_API_URL)
 * @returns {string|null}
 */
function urlDelMedio(mediaUrl, base = origenDelCrm()) {
    if (!mediaUrl) return null;
    const m = String(mediaUrl);
    if (/^https?:\/\//i.test(m)) return m;
    if (m.startsWith('/')) return `${base}${m}`;
    const clave = m.startsWith('local://') ? m.slice('local://'.length) : m;
    return `${base}/api/storage/view?key=${encodeURIComponent(clave)}`;
}

module.exports = { urlDelMedio, origenDelCrm };
