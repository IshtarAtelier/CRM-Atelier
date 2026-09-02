/**
 * Helpers para armar links de WhatsApp que incluyan la página que el cliente
 * está mirando. Al pegar la URL en el mensaje, WhatsApp arma la previsualización
 * con la foto del producto (viene del openGraph de /producto/[slug]).
 */

import { WHATSAPP_PHONE } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://atelieroptica.com.ar";

/**
 * URL absoluta de la página actual, SIEMPRE sobre el dominio canónico.
 *
 * Antes esto tenía una rama `typeof window !== "undefined"` que devolvía
 * `window.location.origin` en el cliente y `SITE_URL` en el servidor. Eso es
 * exactamente el patrón que React nombra primero cuando explica un desajuste de
 * hidratación ("A server/client branch"), y lo estaba produciendo de verdad: el
 * `href` del botón flotante de WhatsApp salía distinto de los dos lados y React
 * 19 reportaba el mismatch en /tienda y en cada ficha de producto. Medido con
 * `npm run check:humo` el 2/9/26.
 *
 * Y el dominio canónico no es solo lo determinístico: es lo correcto. Esta URL
 * viaja DENTRO de un mensaje de WhatsApp a un cliente. Con `window.location`,
 * quien abría el sitio desde un dominio de preview —o desde localhost -- le
 * mandaba al cliente un link que no puede abrir. El link que se comparte tiene
 * que ser siempre el público.
 *
 * Ver también la nota de `buildWhatsAppUrl` acá abajo: es la misma lección
 * aprendida por el otro lado (la frase de origen del anuncio tampoco puede
 * entrar acá, porque vive solo en el navegador).
 */
export function currentPageUrl(pathname?: string): string {
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
