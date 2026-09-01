/**
 * Cómo se DICEN las cuotas en toda superficie que ve un cliente.
 *
 * LA FÓRMULA (Ishtar, 31/8/2026 A LA NOCHE — reemplaza a la de esa mañana):
 *
 *     "3 y 6 cuotas sin interés, y hasta 12 cuotas fijas"
 *
 * Sin el porcentaje y sin "con Mercado Pago" ("no tiene sentido aclarar eso
 * del 10 y mercado pago", textual). La decisión de la mañana pedía aclarar el
 * 10% en toda superficie; a la noche Ishtar la dio vuelta: el % se saca de
 * todos los textos de marketing y comunicación. Historial en dos líneas:
 * hasta el 31/8 convivían dos reglas opuestas, a la mañana ganó "siempre el %",
 * a la noche quedó "nunca el %" — esta es la vigente.
 *
 * LO QUE NO CAMBIÓ (tan importante como lo que sí):
 * - Las 12 JAMÁS se dicen ni se insinúan "sin interés" — sin interés son solo
 *   3 y 6. "Fijas" está bien; "sin interés" nunca.
 * - Los IMPORTES no se disfrazan: la cuota de 12 que se muestra sale de
 *   `PricingService.cuotasMpLargas()` con el recargo ADENTRO (lista × 1,10 ÷ 12).
 *   Se saca la LEYENDA del porcentaje, nunca el número real.
 * - Los labels de MÉTODO DE PAGO en recibos y cotizador ("MP 12c Ish (+10%)")
 *   no son marketing: documentan un cobro y no se tocan.
 *
 * LO OTRO QUE VIVE ACÁ: leer `web_promo_installments` SIN PODER MENTIR.
 * Ese setting es texto libre que se carga desde /admin/web, y tres pantallas
 * (tienda, grilla de categoría y configurador) le sacaban el número con
 * `match(/\d+/)` para dividir el precio y después lo mostraban como
 * "N s/interés de $lista/N". O sea: escribir "12 cuotas" ahí hacía que la
 * tienda publicara sola "12 s/interés de $[lista/12]" — la frase prohibida,
 * y encima con el precio mal (las 12 van lista × 1,10 ÷ 12). `leerPromoCuotas`
 * solo acepta las cantidades que de verdad son sin interés; cualquier otra
 * cosa cae al default en vez de convertirse en una promesa falsa.
 */

import { BUSINESS_INFO } from './business-info';

/**
 * Cómo se nombran las 12 cuotas cuando NO se muestra el importe
 * (chips, listados de medios de pago, textos sin precio a mano).
 */
export const TEXTO_MP_CUOTAS_LARGAS = 'Hasta 12 cuotas fijas';

/**
 * Cómo se nombra la fila de 12 cuotas cuando el importe va en otra columna
 * (tablas de dos columnas: etiqueta a la izquierda, "12 x $X" a la derecha).
 */
export const ETIQUETA_MP_CUOTAS_LARGAS = '12 cuotas fijas';

/**
 * Cómo se nombran las 12 cuotas CON el importe ya resuelto.
 * El importe se calcula en `PricingService.cuotasMpLargas()` — ya trae el
 * recargo adentro. Acá solo se redacta, para que las siete pantallas que lo
 * muestran digan lo mismo.
 */
export function textoCuotas12(importeCuota: number): string {
  return `12 cuotas fijas de $${Math.round(importeCuota).toLocaleString('es-AR')}`;
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
 * /admin/web ni siquiera nombraba las 12. Ahora las tres leen de acá.
 *
 * OJO: esto es el DEFAULT. El valor vivo en producción está en la base
 * (`SystemSetting.web_announcement_text`) y le gana a este texto — cambiarlo se
 * hace desde /admin/web, no desde acá.
 */
export const CARTEL_PROMO_POR_DEFECTO =
  `6 Cuotas Sin Interés • Hasta 12 Cuotas Fijas • ` +
  `${BUSINESS_INFO.discountCashPercent}% OFF en Efectivo o Transferencia • Envío Gratis`;
