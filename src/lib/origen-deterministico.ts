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
import { parseAdTag } from "@/lib/ads/ad-tag-core";
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
