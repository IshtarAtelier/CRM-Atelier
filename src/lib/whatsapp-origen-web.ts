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
