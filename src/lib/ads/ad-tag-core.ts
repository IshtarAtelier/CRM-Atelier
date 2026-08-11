/**
 * Núcleo PURO del parser de etiquetas de anuncio: sin imports, sin Prisma.
 *
 * Existe como archivo aparte para que `scripts/checks/ad-tag-paridad.check.mjs`
 * pueda importarlo directo con `--experimental-strip-types` y comparar
 * resultados contra la copia CommonJS del bot (`wa-service/shared/ad-tag.js`).
 * `ad-tag.ts` reexporta todo esto y suma lo que sí necesita Prisma.
 *
 * SI TOCÁS ESTE ARCHIVO, TOCÁ TAMBIÉN `wa-service/shared/ad-tag.js`.
 */

/**
 * Plataforma de la que vino el clic pago. `[metaFlor]` y `[googleVerano]` son
 * las dos formas del prefill que cargamos nosotros en Ads Manager y en Google
 * Ads; el vocabulario es cerrado a propósito.
 */
export type AdPlatform = 'META' | 'GOOGLE';

export interface ParsedAdTag {
    platform: AdPlatform;
    /** Campaña ya normalizada: "[metaFlor]" → "flor". */
    campaign: string;
}

const AD_TAG_REGEX = /\[\s*(meta|google)([^\]]*?)\s*\]/i;

/**
 * Etiquetas cargadas en Ads Manager sin el prefijo `meta`/`google` pero que
 * son anuncios reales activos. `[ClipsJav]` quedó así en el anuncio de clip-on
 * y el vocabulario cerrado lo hacía invisible: esos leads entraban sin origen.
 * Vocabulario igual de cerrado que el principal — solo lo que existe de verdad.
 */
const ALIAS_REGEX = /\[\s*clipsjav\s*\]/i;

/**
 * ÚNICO parser de la etiqueta del prefill. Todo tiene que pasar por acá.
 *
 * Antes había cuatro copias de este regex y NO eran iguales: `meta-insights.ts`
 * aceptaba `[a-z0-9_ -]` y el resto `[^\]]`, así que un mismo chat podía recibir
 * una etiqueta al entrar por el bot y otra distinta al reportarse. La versión
 * CommonJS para el bot y los scripts vive en `wa-service/shared/ad-tag.js` —los
 * dos mundos se despliegan por separado y no pueden importarse entre sí— y
 * `scripts/checks/ad-tag-paridad.check.mjs` falla si divergen.
 *
 * Reconoce `google` además de `meta`: hasta ahora exigía el literal `meta`, así
 * que un anuncio de Google era estructuralmente invisible por más que le
 * pusieras la etiqueta.
 */
export function parseAdTag(text?: string | null): ParsedAdTag | null {
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
 * Clave que se persiste en `WhatsAppChat.adTag` / `Client.adTag`.
 *
 * Meta va sin prefijo y Google con `google:` adelante. Es deliberado: hay
 * historial de filas de Meta guardadas sin prefijo y los reportes las cruzan por
 * ese valor exacto, así que prefijar Meta invalidaría lo viejo. Con este esquema
 * el histórico sigue leyéndose y lo nuevo de Google queda distinguible.
 *
 * Solo corchetes — a diferencia de adTag() de meta-insights NO deduce por
 * producto, porque esta forma se persiste como columna y una mención casual
 * ("quiero clipones") no puede quedar grabada como origen del cliente.
 */
export function prefillAdTag(text?: string | null): string | null {
    const parsed = parseAdTag(text);
    if (!parsed) return null;
    return parsed.platform === 'GOOGLE' ? `google:${parsed.campaign}` : parsed.campaign;
}

/** Minúsculas, sin tildes, sin puntuación, espacios colapsados. */
function normalizar(text: string): string {
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
 */
export function fallbackAdTag(text?: string | null): string | null {
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
 */
export function stripAdTags(text?: string | null): string {
    return String(text || '').replace(/\[\s*(?:meta|google|clipsjav)[^\]]*\]/gi, '').trim();
}

/** Plataforma a partir de una etiqueta ya guardada en la base. */
export function platformFromStoredTag(tag?: string | null): AdPlatform | null {
    if (!tag) return null;
    return tag.startsWith('google:') ? 'GOOGLE' : 'META';
}
