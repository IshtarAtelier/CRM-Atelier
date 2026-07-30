/**
 * Helpers para armar links de WhatsApp que incluyan la página que el cliente
 * está mirando. Al pegar la URL en el mensaje, WhatsApp arma la previsualización
 * con la foto del producto (viene del openGraph de /producto/[slug]).
 */

import { WHATSAPP_PHONE } from "@/lib/constants";

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
 * OJO: acá NO se agrega la frase de origen ("Los vi en Google Ads."). Se intentó
 * y produce un error de hidratación: el HTML del servidor sale sin la frase (el
 * identificador de clic vive en el navegador) y el primer render del cliente la
 * agrega, así que el href difiere. React 19 no parchea atributos durante la
 * hidratación, así que el href del servidor —sin frase— podía quedar pegado para
 * siempre en la ficha de producto, justo donde aterriza el tráfico pago.
 *
 * La frase la agrega `WhatsAppAttribution` (montado en el layout) interceptando
 * el clic. Ventaja extra: cubre TODOS los links a wa.me del sitio, incluidos los
 * que se arman a mano en las notas del blog y los que se renderizan en el
 * servidor, que con el enfoque anterior quedaban afuera.
 */
export function buildWhatsAppUrl(
  text: string,
  { pageUrl, phone = WHATSAPP_PHONE }: { pageUrl?: string; phone?: string } = {}
): string {
  const body = pageUrl ? `${text}\n\n${pageUrl}` : text;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}
