/**
 * Parser de la etiqueta del prefill de un anuncio, para el mundo CommonJS
 * (el bot y los scripts de scripts/ads).
 *
 * ESPEJO EXACTO de `src/lib/ads/ad-tag-core.ts`. Existen dos copias porque el
 * wa-service se despliega como imagen propia y su Dockerfile solo copia
 * `prisma/` y `wa-service/`: no puede importar nada de `src/`. Para que la
 * duplicación no vuelva a divergir —que es justo lo que pasó antes, con cuatro
 * regex distintos— `scripts/checks/ad-tag-paridad.check.mjs` corre las dos
 * implementaciones sobre el mismo corpus y falla si difieren en un solo caso.
 *
 * SI TOCÁS ESTE ARCHIVO, TOCÁ TAMBIÉN `src/lib/ads/ad-tag-core.ts`.
 */

/** Reconoce `[metaFlor]` y `[googleVerano]`. Vocabulario cerrado a propósito. */
const AD_TAG_REGEX = /\[\s*(meta|google)([^\]]*?)\s*\]/i;

/**
 * Etiquetas cargadas en Ads Manager sin el prefijo `meta`/`google` pero que
 * son anuncios reales activos. `[ClipsJav]` quedó así en el anuncio de clip-on
 * y el vocabulario cerrado lo hacía invisible: esos leads entraban sin origen.
 */
const ALIAS_REGEX = /\[\s*clipsjav\s*\]/i;

/**
 * @param {string|null|undefined} text
 * @returns {{platform: 'META'|'GOOGLE', campaign: string}|null}
 */
function parseAdTag(text) {
  if (!text) return null;
  const m = String(text).match(AD_TAG_REGEX);
  if (m) {
    const campaign = m[2].trim().toLowerCase().replace(/\s+/g, '');
    if (!campaign) return null;
    return { platform: m[1].toLowerCase() === 'google' ? 'GOOGLE' : 'META', campaign };
  }
  if (ALIAS_REGEX.test(String(text))) {
    return { platform: 'META', campaign: 'clipsjav' };
  }
  return null;
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

/** Minúsculas, sin tildes, sin puntuación, espacios colapsados. */
function normalizar(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¡!¿?.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mensajes que Meta manda SIN etiqueta cuando el anuncio se muestra en un
 * formato que no usa el autofill configurado: los formatos imagen/video de
 * varios creativos tienen quick replies genéricas ("Quiero obtener más
 * información") y cuando no hay nada configurado Meta usa su autofill default
 * ("¡Hola! Quiero más información"). El mensaje COMPLETO tiene que ser
 * exactamente una de estas frases (normalizado) — no es un match por contenido.
 */
const PREFILLS_GENERICOS = new Set([
  'hola quiero mas informacion',
  'quiero obtener mas informacion',
]);

/**
 * Atribución de último recurso para mensajes de anuncio SIN etiqueta.
 *
 * Devuelve `'generico'` (adTag de Meta sin campaña identificable) si el mensaje
 * es un prefill genérico conocido de Meta, o si el cliente dice explícitamente
 * que nos vio en Meta. Devuelve null en cualquier otro caso.
 *
 * SOLO para persistir el origen (primer toque, nunca pisa una etiqueta ya
 * grabada). NO participa en decisiones de comportamiento del bot: a diferencia
 * de la etiqueta con corchetes, estas frases las puede escribir un humano en
 * medio de una charla atendida, y forzar el encendido del bot ahí pisaría una
 * conversación humana.
 * @returns {string|null}
 */
function fallbackAdTag(text) {
  if (!text) return null;
  const t = normalizar(String(text));
  if (!t) return null;
  if (PREFILLS_GENERICOS.has(t)) return 'generico';
  if (/\blos vi en meta\b/.test(t)) return 'generico';
  return null;
}

/**
 * Saca las etiquetas del texto para que no interfieran con las detecciones de
 * negativos, post-venta y hostilidad. Antes solo limpiaba `[meta…]`, así que un
 * `[googleBaja]` habría disparado la auto-exclusión por la palabra "baja".
 * @returns {string}
 */
function stripAdTags(text) {
  return String(text || '').replace(/\[\s*(?:meta|google|clipsjav)[^\]]*\]/gi, '').trim();
}

module.exports = { parseAdTag, prefillAdTag, fallbackAdTag, stripAdTags, AD_TAG_REGEX };
