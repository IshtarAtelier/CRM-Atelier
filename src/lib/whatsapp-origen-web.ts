/**
 * La marca "vengo de la web" de todo mensaje que el sitio abre en WhatsApp.
 *
 * El bot y el CRM deciden que un chat vino de la tienda SOLO si el primer
 * mensaje trae una frase conocida (FRASES_DEL_SITIO, en origen-deterministico).
 * El sitio tiene ~60 links a WhatsApp escritos a mano —notas del blog, FAQ,
 * contacto, lentes de contacto, el popup de salida— y la mayoría no la traía:
 * esos chats quedaban sin origen (el 45% de los chats nuevos no tenía ninguna
 * etiqueta, revisión del 8/10/2026). Corregirlos uno por uno se vuelve a romper
 * con el próximo link; por eso la marca la pone UN lugar, WhatsAppAttribution,
 * en el momento del clic, y solo cuando el mensaje no prueba ya un origen.
 */
import { origenDeterministico } from "@/lib/origen-deterministico";

/** Cae dentro de FRASES_DEL_SITIO ("estoy en la web de atelier"). */
export const MARCA_DE_LA_WEB = "Estoy en la web de Atelier.";

export function conMarcaDeLaWeb(texto: string): string {
  if (!texto.trim()) return texto;
  // Ya prueba un origen (frase del sitio, de un anuncio o la etiqueta): no se toca.
  if (origenDeterministico(texto)) return texto;
  // El link de la página va al final (WhatsApp arma la vista previa con él):
  // la marca va antes, pegada al texto.
  const corte = texto.search(/\s*\n+\s*https?:\/\//);
  if (corte > 0) return `${conPunto(texto.slice(0, corte))} ${MARCA_DE_LA_WEB}${texto.slice(corte)}`;
  return `${conPunto(texto)} ${MARCA_DE_LA_WEB}`;
}

/** "…para multifocales" → "…para multifocales." (la marca es otra oración). */
function conPunto(texto: string): string {
  const t = texto.trimEnd();
  return /[.!?…:)]$/.test(t) ? t : `${t}.`;
}

const FRASE_DE_ANUNCIO_YA_PUESTA = /^Los vi en (Google Ads|Meta|un anuncio de (Google|Instagram))\./i;

/**
 * El href con el que se abre WhatsApp al hacer clic, o null si queda igual.
 * Toda la decisión de WhatsAppAttribution, en una función pura para que
 * check:origen la pruebe con casos (antes el check buscaba texto en el
 * componente y pasaba aunque se borrara la guarda del número):
 *  · nunca desde el CRM (/admin, /login): ahí el mensaje es del vendedor;
 *  · sin texto prellenado no se inventa uno;
 *  · con identificador de anuncio, la frase del anuncio va adelante;
 *  · solo hacia el número de la tienda, la marca de la web si no hay origen.
 */
export function hrefConOrigen(opts: {
  href: string;
  pathname: string;
  fraseAnuncio: string | null | undefined;
  telefonoTienda: string;
}): string | null {
  if (/^\/(admin|login)(\/|$)/.test(opts.pathname)) return null;
  let url: URL;
  try {
    url = new URL(opts.href);
  } catch {
    return null;
  }
  if (!/(^|\.)wa\.me$|(^|\.)api\.whatsapp\.com$/.test(url.hostname)) return null;
  const texto = url.searchParams.get('text');
  if (!texto) return null;

  let nuevo = texto;
  if (opts.fraseAnuncio && !FRASE_DE_ANUNCIO_YA_PUESTA.test(texto.trim())) nuevo = `${opts.fraseAnuncio} ${texto}`;
  const numero = (url.searchParams.get('phone') || url.pathname).replace(/\D/g, '');
  if (numero && numero === opts.telefonoTienda.replace(/\D/g, '')) nuevo = conMarcaDeLaWeb(nuevo);
  if (nuevo === texto) return null;

  // Se reescribe a mano en vez de usar searchParams.set: ese serializa los
  // espacios como "+" y el resto del sitio los manda como %20. No mezclamos
  // codificaciones en algo que el cliente va a ver escrito en su WhatsApp.
  const otros = [...url.searchParams.entries()]
    .filter(([k]) => k !== 'text')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return `${url.origin}${url.pathname}?${['text=' + encodeURIComponent(nuevo), ...otros].join('&')}`;
}
