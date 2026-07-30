/**
 * Helpers para armar links de WhatsApp que incluyan la página que el cliente
 * está mirando. Al pegar la URL en el mensaje, WhatsApp arma la previsualización
 * con la foto del producto (viene del openGraph de /producto/[slug]).
 */

import { WHATSAPP_PHONE } from "@/lib/constants";
import { adPlatformSentence } from "@/lib/client-analytics";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://atelieroptica.com.ar";

/**
 * URL absoluta de la página actual. Usa `window.location` cuando existe (así el
 * link es exactamente el que ve el cliente, con su dominio real) y cae al
 * dominio canónico + pathname en el render del servidor.
 */
export function currentPageUrl(pathname?: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return `${SITE_URL}${pathname || ""}`;
}

/**
 * Link de wa.me con el texto ya encodeado y la URL de la página al final.
 *
 * Si el visitante llegó desde un aviso (hay gclid/wbraid/gbraid de Google o
 * fbclid de Meta), el mensaje arranca diciendo "Los vi en Google Ads." o
 * "Los vi en Meta.". Así el origen viaja con la consulta y lo lee el portero,
 * en vez de depender de que alguien lo adivine tres días después.
 *
 * Solo se agrega del lado del cliente: en el render del servidor todavía no se
 * sabe de dónde vino (el identificador vive en el navegador). Un link renderizado
 * en el servidor sale sin la frase, no con una equivocada.
 *
 * `attribution: false` lo desactiva para los links que no son una consulta de
 * venta (por ejemplo el botón de una página de error).
 */
export function buildWhatsAppUrl(
  text: string,
  {
    pageUrl,
    phone = WHATSAPP_PHONE,
    attribution = true,
  }: { pageUrl?: string; phone?: string; attribution?: boolean } = {}
): string {
  const origen = attribution ? adPlatformSentence() : "";
  const conOrigen = origen ? `${origen} ${text}` : text;
  const body = pageUrl ? `${conOrigen}\n\n${pageUrl}` : conOrigen;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}
