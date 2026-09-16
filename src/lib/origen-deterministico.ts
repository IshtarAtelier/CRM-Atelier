/**
 * Origen del contacto cuando el PRIMER MENSAJE del cliente lo prueba solo.
 *
 * Hay mensajes que no dejan lugar a interpretación: la etiqueta entre corchetes
 * que cargamos en los anuncios (`[metaClip]`, `[googleSearch-recetados]`), la
 * frase precargada de los anuncios de Google ("Vi su anuncio en Google…") y los
 * textos con los que el SITIO abre WhatsApp ("Los vi en la nueva web de
 * Atelier…", "Estoy recorriendo la tienda online…"). Cuando aparece uno de esos,
 * el origen NO se elige: se detecta, y el formulario lo muestra bloqueado.
 *
 * Por qué existe (16/9/2026): de 48 fichas marcadas "Google Ads" en 30 días sin
 * la frase del anuncio, 10 tenían en el primer mensaje una prueba de OTRO
 * origen — tres con etiqueta de Meta, siete con el texto del botón de la web —
 * y aun así una persona eligió "Google Ads" en el desplegable. Eso infla la
 * plata atribuida a Google con ventas de Meta y de gente que llegó sola. Donde
 * hay prueba, no hay que dejar elegir.
 *
 * Puro, sin imports de Prisma: lo comparte el extractor de fichas del CRM y lo
 * testea scripts/checks/origen-deterministico.check.mjs. El bot (wa-service)
 * lleva su copia CommonJS de estas mismas reglas en tools.js — si tocás una,
 * tocá la otra.
 */
import { parseAdTag, platformFromStoredTag } from "@/lib/ads/ad-tag-core";
import type { ContactSource } from "@/lib/contact-source";

export interface OrigenDetectado {
    origen: ContactSource;
    /** Para mostrarle a quien carga la ficha por qué no puede cambiarlo. */
    motivo: string;
}

// Textos con los que el sitio abre WhatsApp. Fuentes: FloatingWhatsApp.tsx
// ("Los vi en la nueva web de Atelier…", "Estoy recorriendo la tienda online…"),
// FilmmakerReel.tsx ("entré a la web de Atelier…") y la landing
// ("Vi sus anteojos en la web…"). Se buscan por fragmento estable, no por el
// texto entero, para que un cambio de redacción menor no rompa la detección.
const FRASES_DEL_SITIO = /nueva web de atelier|recorriendo la tienda online|entr[eé] a la web de atelier|vi sus anteojos en la web/i;
const FRASES_ANUNCIO_GOOGLE = /vi su anuncio en google|los vi en google ads|encontr[eé] este producto en google|share\.google/i;
const FRASE_META_SITIO = /los vi en meta\b/i;

export function origenDeterministico(primerMensaje: string | null | undefined): OrigenDetectado | null {
    const texto = (primerMensaje || "").trim();
    if (!texto) return null;

    // 1) La etiqueta del anuncio es la prueba más fuerte: dice canal Y anuncio.
    const tag = parseAdTag(texto);
    if (tag) {
        return tag.platform === "GOOGLE"
            ? { origen: "Google Ads", motivo: `el mensaje trae la etiqueta del anuncio de Google (${tag.campaign})` }
            : { origen: "Meta", motivo: `el mensaje trae la etiqueta del anuncio de Meta (${tag.campaign})` };
    }
    // 2) Frases precargadas por las plataformas de pauta.
    if (FRASES_ANUNCIO_GOOGLE.test(texto)) return { origen: "Google Ads", motivo: "el mensaje es el texto precargado de los anuncios de Google" };
    if (FRASE_META_SITIO.test(texto)) return { origen: "Meta", motivo: "el sitio detectó que llegó desde un anuncio de Meta" };
    // 3) Frases del propio sitio: llegó a la web y tocó el botón de WhatsApp.
    //    Sin etiqueta de pauta adelante, es tráfico propio (orgánico/directo).
    if (FRASES_DEL_SITIO.test(texto)) return { origen: "Tienda online", motivo: "el mensaje es el texto del botón de WhatsApp de la web" };
    return null;
}

/**
 * Lo mismo, pero mirando TODO lo que dejó el chat: la etiqueta guardada y los
 * mensajes del cliente, no solo el primero.
 *
 * Por qué (medido en producción el 16/9/2026, 90 días): 47 fichas de Meta
 * quedaron sin origen TENIENDO la etiqueta del anuncio guardada en el chat.
 * Dos motivos, los dos arreglados acá:
 *   · `WhatsAppChat.adTag` no se miraba, y es la prueba más dura que existe: la
 *     escribe el portero con el referral del clic (sin prefijo = Meta).
 *   · Meta manda primero un entrante VACÍO con ese referral, así que "el primer
 *     mensaje" era "" y la detección se rendía antes de leer nada.
 *
 * El orden es primer toque: la etiqueta primero, después el primer mensaje que
 * pruebe algo. Así, si alguien llegó por un anuncio y más tarde manda el link
 * de la tienda, sigue contando como el anuncio que lo trajo.
 */
export function origenDeChat(
    { adSourceId, adTag, mensajesEntrantes }: { adSourceId?: string | null; adTag?: string | null; mensajesEntrantes: (string | null | undefined)[] }
): OrigenDetectado | null {
    // El id del anuncio que manda Meta con el clic (WhatsAppChat.adSourceId) es
    // la prueba más dura de todas: viaja por fuera del mensaje, así que vale
    // aunque el cliente borre o reescriba el texto precargado. Va primero.
    if ((adSourceId || "").trim()) {
        return { origen: "Meta", motivo: `Meta avisó que el chat entró por un anuncio (${String(adSourceId).trim()})` };
    }
    const guardada = (adTag || "").trim();
    if (guardada) {
        const plataforma = platformFromStoredTag(guardada);
        const campana = guardada.replace(/^google:/, "");
        return plataforma === "GOOGLE"
            ? { origen: "Google Ads", motivo: `el chat entró por un anuncio de Google (${campana})` }
            : { origen: "Meta", motivo: `el chat entró por un anuncio de Meta (${campana})` };
    }
    for (const mensaje of mensajesEntrantes) {
        const detectado = origenDeterministico(mensaje);
        if (detectado) return detectado;
    }
    return null;
}
