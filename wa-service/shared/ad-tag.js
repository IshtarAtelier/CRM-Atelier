/**
 * Parser de la etiqueta del prefill de un anuncio, para el mundo CommonJS
 * (el bot y los scripts de scripts/ads).
 *
 * ESPEJO EXACTO de `src/lib/ads/ad-tag.ts`. Existen dos copias porque el
 * wa-service se despliega como imagen propia y su Dockerfile solo copia
 * `prisma/` y `wa-service/`: no puede importar nada de `src/`. Para que la
 * duplicación no vuelva a divergir —que es justo lo que pasó antes, con cuatro
 * regex distintos— `scripts/checks/ad-tag-paridad.check.mjs` corre las dos
 * implementaciones sobre el mismo corpus y falla si difieren en un solo caso.
 *
 * SI TOCÁS ESTE ARCHIVO, TOCÁ TAMBIÉN `src/lib/ads/ad-tag.ts`.
 */

/** Reconoce `[metaFlor]` y `[googleVerano]`. Vocabulario cerrado a propósito. */
const AD_TAG_REGEX = /\[\s*(meta|google)([^\]]*?)\s*\]/i;

/**
 * @param {string|null|undefined} text
 * @returns {{platform: 'META'|'GOOGLE', campaign: string}|null}
 */
function parseAdTag(text) {
  if (!text) return null;
  const m = String(text).match(AD_TAG_REGEX);
  if (!m) return null;
  const campaign = m[2].trim().toLowerCase().replace(/\s+/g, '');
  if (!campaign) return null;
  return { platform: m[1].toLowerCase() === 'google' ? 'GOOGLE' : 'META', campaign };
}

/**
 * Clave que se persiste en WhatsAppChat.adTag / Client.adTag. Meta sin prefijo
 * (hay historial guardado así y los reportes lo cruzan por ese valor exacto),
 * Google con `google:` adelante.
 * @returns {string|null}
 */
function prefillAdTag(text) {
  const parsed = parseAdTag(text);
  if (!parsed) return null;
  return parsed.platform === 'GOOGLE' ? `google:${parsed.campaign}` : parsed.campaign;
}

/**
 * Saca las etiquetas del texto para que no interfieran con las detecciones de
 * negativos, post-venta y hostilidad. Antes solo limpiaba `[meta…]`, así que un
 * `[googleBaja]` habría disparado la auto-exclusión por la palabra "baja".
 * @returns {string}
 */
function stripAdTags(text) {
  return String(text || '').replace(/\[\s*(?:meta|google)[^\]]*\]/gi, '').trim();
}

module.exports = { parseAdTag, prefillAdTag, stripAdTags, AD_TAG_REGEX };
