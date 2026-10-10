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
 * - La línea del RESUMEN DEL CHECKOUT que suma el recargo al total
 *   ("12 cuotas fijas (10%) +$16.000", `ETIQUETA_COSTO_FINANCIERO_MP`) lleva
 *   el %: pedido de Ishtar del 25/9/2026 — sin él, "+$16.000" a secas se leía
 *   raro. Es la misma lógica que los recibos: documenta el cobro que la
 *   persona está por hacer, no lo promociona. El resto del checkout (opciones
 *   de pago, chips, botón) sigue sin el %.
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
import { RECARGO_MP_CUOTAS_LARGAS } from './constants/descuentos';

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
 * La línea del resumen del checkout que explica por qué el total de 12 cuotas
 * es más alto que el subtotal. ÚNICA superficie de venta que dice el % (ver
 * arriba). No se escribe "CFT": en Argentina el CFT es una tasa anual
 * regulada y este 10% no es ese número. El % va entre paréntesis pegado a
 * las 12 cuotas y SOLO acá (Ishtar, 25/9/2026): tiene que leerse que el
 * recargo es por elegir 12, no un cargo que se suma a cualquier compra.
 */
export const ETIQUETA_COSTO_FINANCIERO_MP = `${ETIQUETA_MP_CUOTAS_LARGAS} (${RECARGO_MP_CUOTAS_LARGAS}%)`;

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
 *
 * El descuento dice "por Transferencia" y no "en Efectivo o Transferencia":
 * el cartel se lee en la tienda online, donde el efectivo no existe como
 * medio con descuento (el checkout lo aplica solo a TRANSFER). El efectivo en
 * el local tiene su propio descuento, `discountCashLocalPercent` (auditoría
 * del 25/9/2026).
 */
export const CARTEL_PROMO_POR_DEFECTO =
  `6 Cuotas Sin Interés • Hasta 12 Cuotas Fijas • ` +
  `${BUSINESS_INFO.discountTransferPercent}% OFF por Transferencia • Envío Gratis`;

/**
 * Lo que el cartel de arriba de la tienda NO puede decir, con el motivo que
 * ve quien lo edita en /admin/web. Vacío = se puede guardar.
 *
 * El texto vivo está en la base y le gana al default: el 10/10/2026 en
 * producción decía "15% OFF en Efectivo o Transferencia", que la tienda no
 * cumple (online el descuento es solo por transferencia; el efectivo es del
 * local). Nada impedía guardarlo, así que las reglas se fijan acá y las
 * aplica la ruta que guarda la configuración.
 */
export function problemasDelCartel(texto: string): string[] {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const problemas: string[] = [];
  if (/\befectivo\b/.test(t)) {
    problemas.push('En la tienda online el descuento es solo por transferencia: el efectivo es del local. Escribí "por Transferencia".');
  }
  // Las 12 son FIJAS; sin interés son solo 3 y 6 (CLAUDE.md). Se mira a qué
  // número queda pegado cada "sin interés": "12 cuotas fijas y 3 o 6 sin
  // interés" está bien; "hasta 12 cuotas, sin interés", "12x sin interés",
  // "3/6/12 sin interés" y "sin interés hasta en 12 cuotas" no. Fechas,
  // precios y horas ("12/10", "12 de octubre", "$12.000", "12 mil") no son
  // cuotas. Se mira el texto entero y no por tramo: "Hasta 12 cuotas • Sin
  // interés" se lee igual en la barra que rota.
  if (prometeDoceSinInteres(t)) {
    problemas.push(`Las 12 cuotas no son sin interés: van como "${TEXTO_MP_CUOTAS_LARGAS}". Sin interés son solo 3 y 6.`);
  }
  return problemas;
}

/** Sinónimos de "sin interés" que se usan en carteles. */
const SIN_INTERES = /sin[\s-]+interes|s\/\s*i(nt(eres)?)?\b|sin\s+recargo|libres?\s+de\s+interes|0\s*%\s*(de\s+)?interes|interes\s*0\b|\bcsi\b/g;
const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
/** Cantidades de cuotas que se escriben en listas ("3/6/12", "3, 6 y 12"). */
const CUOTAS_POSIBLES = new Set([3, 6, 12, 18, 24]);

/**
 * Los números de CUOTAS del texto (no fechas, precios, horas ni porcentajes),
 * con su posición. Sin lookbehind a propósito: este módulo lo carga el
 * navegador en toda la tienda, y Safari anterior a 16.4 no lo entiende — el
 * archivo entero dejaba de cargar en iPhones con iOS 15 (revisión del 10/10/2026).
 */
function numerosDeCuotas(t: string): { pos: number; valor: number }[] {
  const salida: { pos: number; valor: number }[] = [];
  const palabras: Record<string, number> = { tres: 3, seis: 6, doce: 12 };
  const re = /(\$\s*)?(\d+(?:\.\d{3})+|\d+)|\b(tres|seis|doce)\b/g;
  for (const m of t.matchAll(re)) {
    const pos = m.index ?? 0;
    if (m[3]) {
      salida.push({ pos, valor: palabras[m[3]] });
      continue;
    }
    if (m[1] || m[2].includes('.')) continue; // precio: "$12.000", "12.000"
    const valor = Number(m[2]);
    const despues = t.slice(pos + m[0].length);
    if (/^\s*(mil\b|%|hs?\b|:\d)/.test(despues)) continue; // "12 mil", "15%", "12 hs", "12:30"
    if (new RegExp(`^\\s+de\\s+(${MESES})`).test(despues)) continue; // "12 de octubre"
    const barra = /^\/(\d+)/.exec(despues);
    const antesBarra = /(\d+)\/$/.exec(t.slice(0, pos));
    // "12/10" es una fecha; "3/6/12" es una lista de cuotas (todos posibles).
    if (barra && !CUOTAS_POSIBLES.has(Number(barra[1]))) continue;
    if (antesBarra && !(CUOTAS_POSIBLES.has(Number(antesBarra[1])) && CUOTAS_POSIBLES.has(valor))) continue;
    salida.push({ pos, valor });
  }
  return salida;
}

function prometeDoceSinInteres(textoNormalizado: string): boolean {
  // "12x", "x12" → "12 cuotas" (la x pegada al número es lo mismo).
  const t = textoNormalizado.replace(/(\d+)\s*x\b/g, '$1 cuotas').replace(/\bx\s*(\d+)/g, '$1 cuotas');
  const numeros = numerosDeCuotas(t);
  if (!numeros.some((n) => n.valor >= 12)) return false;
  for (const m of t.matchAll(SIN_INTERES)) {
    const pos = m.index ?? 0;
    // El número más cercano ANTES del "sin interés" es el que lo lleva; si no
    // hay ninguno antes, el primero de después ("sin interés hasta 12…").
    const antes = numeros.filter((n) => n.pos < pos).pop();
    const dueno = antes ?? numeros.find((n) => n.pos > pos);
    if (dueno && dueno.valor >= 12) return true;
  }
  return false;
}

/**
 * El cartel que se MUESTRA: el de /admin/web si cumple las reglas, y si no el
 * de por defecto. La regla se aplica también al leer, no solo al guardar: el
 * texto que ya estaba en la base ("15% OFF en Efectivo o Transferencia", 10/10/2026)
 * dejaba de valer apenas se deploya, sin tocar la base a mano.
 */
export function cartelQueSePuedeMostrar(guardado: string | null | undefined): string {
  const texto = (guardado || '').trim();
  if (!texto || problemasDelCartel(texto).length > 0) return CARTEL_PROMO_POR_DEFECTO;
  return texto;
}
