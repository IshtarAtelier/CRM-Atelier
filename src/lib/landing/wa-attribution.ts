/**
 * La línea de atribución que viaja DENTRO del mensaje de WhatsApp que abre la
 * landing. Es lo único que une "hizo clic en el anuncio X" con "este chat":
 * el bot lee el primer mensaje, saca la etiqueta entre corchetes con
 * `prefillAdTag()` y la guarda en `WhatsAppChat.adTag` / `Client.adTag`.
 *
 * Por qué existe como helper puro: hasta el 15/9/2026 la landing armaba esta
 * línea adentro del componente y decía
 *     "— Campaña: default (search-recetados) · origen: google"
 * que se lee bien… y que el bot NO parsea. La gramática de las etiquetas es
 * cerrada — `[metaXxx]` / `[googleXxx]`, ver ad-tag-core.ts — y sin corchetes
 * `prefillAdTag()` devuelve null. Resultado medido contra producción: TODOS
 * los chats que entraban desde /landing quedaban sin etiqueta, y el reporte de
 * pauta decía que Google "no deja etiqueta". La dejaba, con el formato
 * equivocado. Ahora la línea conserva el texto legible para la vendedora Y
 * agrega la etiqueta en el formato que el bot entiende.
 *
 * Sin imports a propósito: lo usa un componente cliente y lo testea
 * `scripts/checks/landing-atribucion.check.mjs` con strip-types.
 */

export interface DatosDeLaVisita {
    utmSource?: string | null;
    utmCampaign?: string | null;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    fbclid?: string | null;
    referrerHost?: string | null;
}

/** De qué plataforma pagó el clic, o null si no hay señal de pauta. */
export function plataformaDeLaVisita(v: DatosDeLaVisita): 'google' | 'meta' | null {
    const src = (v.utmSource || '').toLowerCase();
    if (v.gclid || v.gbraid || v.wbraid || /google/.test(src)) return 'google';
    if (v.fbclid || /^(meta|facebook|fb|instagram|ig)/.test(src)) return 'meta';
    return null;
}

/**
 * Nombre de campaña apto para ir entre corchetes: sin `]`, sin espacios, sin
 * caracteres raros. El parser normaliza a minúsculas, así que acá no importa.
 */
function nombreParaEtiqueta(valor: string): string {
    return valor.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 60);
}

/**
 * La etiqueta en el formato que reconoce el bot: `[googleSearch-recetados]`,
 * `[metaFlor]`. Null cuando la visita no viene de pauta (orgánico, directo): un
 * chat sin anuncio detrás NO debe llevar etiqueta, o inflaría el ROAS.
 */
export function etiquetaDeAnuncio(slug: string, v: DatosDeLaVisita): string | null {
    const plataforma = plataformaDeLaVisita(v);
    if (!plataforma) return null;
    const campana = nombreParaEtiqueta(v.utmCampaign || slug);
    if (!campana) return null;
    return `[${plataforma}${campana}]`;
}

/** El id del clic sin nada que no sea un id: letras, números, `_` y `-`. */
function idDeClicLimpio(valor: string | null | undefined): string | null {
    const limpio = String(valor || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200);
    return limpio.length >= 10 ? limpio : null;
}

/**
 * El marcador del clic de Google: `[gclid:…]`, o `[wbraid:…]` / `[gbraid:…]`
 * cuando Google no manda gclid (iOS). Es lo que después permite subir la venta
 * del mostrador a Google como conversión offline: sin el id del clic, Google no
 * puede unir la venta con el anuncio (ver
 * src/services/google-offline-conversions.service.ts). Null si la visita no
 * vino de un clic de Google. El parser que lo lee es `parseClickId()` en
 * ad-tag-core.ts y su espejo del bot.
 */
export function marcadorDeClic(v: DatosDeLaVisita): string | null {
    const gclid = idDeClicLimpio(v.gclid);
    if (gclid) return `[gclid:${gclid}]`;
    const wbraid = idDeClicLimpio(v.wbraid);
    if (wbraid) return `[wbraid:${wbraid}]`;
    const gbraid = idDeClicLimpio(v.gbraid);
    if (gbraid) return `[gbraid:${gbraid}]`;
    return null;
}

/**
 * La línea completa que se anexa al mensaje: legible para quien atiende, y con
 * la etiqueta al final para el bot.
 */
export function lineaAtribucionWhatsApp(slug: string, v: DatosDeLaVisita): string {
    const origen =
        v.utmSource ||
        (v.gclid || v.gbraid || v.wbraid ? 'google-ads' : '') ||
        (v.fbclid ? 'meta-ads' : '') ||
        v.referrerHost ||
        '';
    let line = `\n\n— Campaña: ${slug}`;
    if (v.utmCampaign) line += ` (${v.utmCampaign})`;
    if (origen) line += ` · origen: ${origen}`;
    const etiqueta = etiquetaDeAnuncio(slug, v);
    if (etiqueta) line += ` ${etiqueta}`;
    // Después de la etiqueta, el id del clic: el bot lo ignora (stripAdTags lo
    // saca) y el CRM lo usa para subir la venta a Google.
    const clic = marcadorDeClic(v);
    if (clic) line += ` ${clic}`;
    return line;
}
