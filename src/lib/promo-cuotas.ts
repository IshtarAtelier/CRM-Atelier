/**
 * Cómo se DICEN las cuotas en toda superficie que ve un cliente.
 *
 * Dos cosas viven acá, y las dos existen porque estaban copiadas:
 *
 * 1. LA ACLARACIÓN DEL COSTO FINANCIERO DE LAS 12 CUOTAS.
 *    Decisión explícita de Ishtar del 31/8/2026: el 10% de las 12 cuotas de
 *    Mercado Pago se ACLARA SIEMPRE — tienda, checkout, mails, PDFs, plantillas
 *    de WhatsApp, piezas de redes, anuncios y blog. Y las 12 NUNCA se anuncian
 *    "sin interés": sin interés son solo 3 y 6. Hasta ese día convivían dos
 *    reglas opuestas en el repo (business-info.ts y los generadores de redes
 *    decían "nunca el %", CLAUDE.md y PricingService decían "siempre"), y el
 *    resultado fue una capa entera de marketing publicando la cuota sin decir
 *    que estaba financiada. El porcentaje sale de `RECARGO_MP_CUOTAS_LARGAS`,
 *    nunca escrito a mano: si el acuerdo con MP cambia, cambia en un solo lado.
 *
 * 2. LEER `web_promo_installments` SIN PODER MENTIR.
 *    Ese setting es texto libre que se carga desde /admin/web, y tres pantallas
 *    (tienda, grilla de categoría y configurador) le sacaban el número con
 *    `match(/\d+/)` para dividir el precio y después lo mostraban como
 *    "N s/interés de $lista/N". O sea: escribir "12 cuotas" ahí hacía que la
 *    tienda publicara sola "12 s/interés de $[lista/12]" — la frase prohibida,
 *    y encima con el precio mal (las 12 van lista × 1,10 ÷ 12). `leerPromoCuotas`
 *    solo acepta las cantidades que de verdad son sin interés; cualquier otra
 *    cosa cae al default en vez de convertirse en una promesa falsa.
 */

import { BUSINESS_INFO } from './business-info';
import { RECARGO_MP_CUOTAS_LARGAS } from './constants/descuentos';

/**
 * "10% de costo financiero" — la aclaración obligatoria de las 12 cuotas.
 *
 * ES LA PARTE INVARIANTE: cambie el layout que cambie, esta frase aparece,
 * textual, pegada a la cuota de 12. Lo único que se adapta es el prefijo, según
 * si la pantalla ya muestra el importe o el medio de pago al lado — por eso hay
 * tres armados abajo y no tres redacciones. Antes de unificar había cuatro
 * distintas ("12 cuotas fijas", "12 cuotas de", "Hasta 12 cuotas", "12 x $"),
 * ninguna con el costo financiero.
 */
export const ACLARACION_MP_CUOTAS_LARGAS = `${RECARGO_MP_CUOTAS_LARGAS}% de costo financiero`;

/**
 * Cómo se nombran las 12 cuotas cuando NO se muestra el importe
 * (chips, listados de medios de pago, textos sin precio a mano).
 */
export const TEXTO_MP_CUOTAS_LARGAS = `12 cuotas con Mercado Pago (${ACLARACION_MP_CUOTAS_LARGAS})`;

/**
 * Cómo se nombra la fila de 12 cuotas cuando el importe va en otra columna
 * (tablas de dos columnas: etiqueta a la izquierda, "12 x $X" a la derecha).
 */
export const ETIQUETA_MP_CUOTAS_LARGAS = `12 cuotas (${ACLARACION_MP_CUOTAS_LARGAS})`;

/**
 * Cómo se nombran las 12 cuotas CON el importe ya resuelto.
 * El importe se calcula en `PricingService.cuotasMpLargas()` — acá solo se
 * redacta, para que las siete pantallas que lo muestran digan lo mismo.
 */
export function textoCuotas12(importeCuota: number): string {
  return `12 cuotas de $${Math.round(importeCuota).toLocaleString('es-AR')} (${ACLARACION_MP_CUOTAS_LARGAS})`;
}

/** Las únicas cantidades de cuotas que son de verdad sin interés. */
export const CUOTAS_SIN_INTERES: readonly number[] = [3, 6];

/** Lo que dice el cartel cuando el setting está vacío o no es confiable. */
export const TEXTO_CUOTAS_POR_DEFECTO = '6 cuotas sin interés';

export interface PromoCuotas {
  /** Por cuánto se divide el precio de lista. Siempre 3 o 6. */
  cantidad: number;
  /** El texto que se muestra. Es el del setting solo si su número es válido. */
  texto: string;
}

/**
 * Lee el setting `web_promo_installments` de forma que no pueda producir una
 * promesa falsa.
 *
 * Si el texto trae un número que NO es de los que se venden sin interés (3 o 6),
 * se ignora entero y se cae al default: mostrar "12 s/interés" porque alguien
 * tipeó "12 cuotas" en un campo de texto libre es peor que mostrar la promo
 * conservadora. Las 12 cuotas de Mercado Pago tienen su propio camino
 * (`PricingService.cuotasMpLargas` + `textoCuotas12`), que sí incluye el recargo.
 */
export function leerPromoCuotas(textoCrudo?: string | null): PromoCuotas {
  const texto = (textoCrudo || '').trim();
  const n = Number(texto.match(/\d+/)?.[0]);
  if (texto && Number.isFinite(n) && CUOTAS_SIN_INTERES.includes(n)) {
    return { cantidad: n, texto };
  }
  return { cantidad: 6, texto: TEXTO_CUOTAS_POR_DEFECTO };
}

/**
 * El cartel de arriba de la tienda cuando `SystemSetting.web_announcement_text`
 * no está cargado.
 *
 * Estaba escrito TRES veces, con tres textos distintos: `web-settings.ts` decía
 * "Hasta 12 Cuotas", `StorefrontNavbar.tsx` lo mismo, y el formulario de
 * /admin/web ni siquiera nombraba las 12. Ninguna de las tres aclaraba el costo
 * financiero. Ahora las tres leen de acá, y el porcentaje y el descuento salen
 * de sus constantes, así que el cartel no puede quedar viejo por su cuenta.
 *
 * OJO: esto es el DEFAULT. El valor vivo en producción está en la base
 * (`SystemSetting.web_announcement_text`) y le gana a este texto — cambiarlo se
 * hace desde /admin/web, no desde acá.
 */
export const CARTEL_PROMO_POR_DEFECTO =
  `6 Cuotas Sin Interés • 12 Cuotas con Mercado Pago (${ACLARACION_MP_CUOTAS_LARGAS}) • ` +
  `${BUSINESS_INFO.discountCashPercent}% OFF en Efectivo o Transferencia • Envío Gratis`;
