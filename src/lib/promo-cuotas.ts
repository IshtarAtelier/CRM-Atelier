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
 * Lo que el cartel de arriba de la tienda NO puede decir, separado por cuán
 * seguro es:
 *  · `bloqueantes`: inequívoco. "Efectivo" en la tienda online (el descuento es
 *    solo por transferencia; el efectivo es del local). No se guarda, y si ya
 *    estaba guardado tampoco se muestra.
 *  · `dudosos`: parece prometer 12 cuotas sin interés (sin interés son solo 3
 *    y 6; las 12 son fijas). La detección lee el texto, así que puede
 *    equivocarse: al guardar pide confirmación, y al mostrar NO reemplaza nada
 *    (un falso positivo no puede tapar un cartel legítimo en vivo).
 *
 * El texto vivo está en la base y le gana al default: el 10/10/2026 producción
 * decía "15% OFF en Efectivo o Transferencia" y nada impedía guardarlo.
 */
export function revisarCartel(texto: string): { bloqueantes: string[]; dudosos: string[] } {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const bloqueantes: string[] = [];
  const dudosos: string[] = [];
  if (/\befectivo\b/.test(t)) {
    bloqueantes.push('En la tienda online el descuento es solo por transferencia: el efectivo es del local. Escribí "por Transferencia".');
  }
  if (prometeDoceSinInteres(t)) {
    dudosos.push(`Parece decir que las 12 cuotas son sin interés: van como "${TEXTO_MP_CUOTAS_LARGAS}". Sin interés son solo 3 y 6.`);
  }
  return { bloqueantes, dudosos };
}

/** Todo lo que el cartel no debería decir (bloqueante o dudoso). */
export function problemasDelCartel(texto: string): string[] {
  const r = revisarCartel(texto);
  return [...r.bloqueantes, ...r.dudosos];
}

/** Sinónimos de "sin interés" que se usan en carteles. */
const SIN_INTERES = /sin[\s-]+interes|sin\s+int\b\.?|s\/\s*i(nt(eres)?)?\b|\bs\.\s*i\b\.?|sin\s+recargo|sin\s+costo\s+financiero|libres?\s+de\s+interes|0\s*%\s*(de\s+)?interes|\b0\s+interes|interes\s*0\b|\b(tasa|tna)\s*0\b|\bcsi\b/g;
/** Una lista de cantidades de cuotas: "12", "3 y 6", "3, 6 y 12", "3/6/12", "6 o 12". */
const LISTA = String.raw`\d+(?:\s*(?:,|\/|-|\by\b|\bo\b)\s*\d+)*`;
/**
 * Lo que puede ir entre la lista y el "sin interés": "12 cuotas, sin interés",
 * "12 cuotas fijas sin interés", "12 cuotas de $5.000 sin interés", "12 cuotas
 * con todas las tarjetas sin interés". El grupo 2 avisa si dijo "fijas".
 */
const DESPUES_DE_LISTA = String.raw` ?(?:(?:cuotas?|pagos?)(?: (fijas?|promocionales?))?)?(?: de \$ ?[\d.]+)?(?: con (?:todas las )?tarjetas?(?: de credito)?)? ?[,:]? ?`;
const PALABRAS_SIN_SUJETO = new Set(['cuotas', 'cuota', 'sin', 'interes', 'en', 'todas', 'las', 'con', 'tarjeta', 'tarjetas', 'de', 'credito', 'y', 'hasta', 'pagos', 'pago', 'todos', 'los', 'medios', 'para', 'vos', 'tu', 'compra']);

const numerosDe = (lista: string) => (lista.match(/\d+/g) || []).map(Number);

/**
 * ¿Algún "sin interés" queda pegado a 12 o más? Sin lookbehind a propósito:
 * este módulo lo carga el navegador en toda la tienda, y Safari anterior a
 * 16.4 no lo entiende (el archivo entero dejaba de cargar en iOS 15).
 *
 * Solo cuentan los números pegados a "cuotas"/"pagos" o al "sin interés":
 * "garantía de 12 meses", "envío en 24 horas", "del 13 al 15 de mayo", "hasta
 * el 24/12" no son cuotas. Se mira tramo por tramo (como rota la barra):
 *  1. la lista justo ANTES ("3 y 6 cuotas sin interés", "hasta 12 cuotas, sin interés");
 *  2. si no, la lista justo DESPUÉS ("sin interés en 3, 6 y 12 cuotas");
 *  3. si el tramo no tiene números ni otro sujeto ("Cuotas sin interés"), la
 *     lista de cuotas del tramo anterior que no diga "fijas" ("Hasta 12 cuotas
 *     • Sin interés").
 */
function prometeDoceSinInteres(textoNormalizado: string): boolean {
  // Espacios colapsados y largo acotado: el cartel es una línea, y así
  // ninguna expresión puede tardar (corre en la barra de cada visitante).
  const t = textoNormalizado
    .replace(/\s+/g, ' ').slice(0, 400)
    .replace(/\bdoce\b/g, '12').replace(/\bseis\b/g, '6').replace(/\btres\b/g, '3')
    // "12x", "x12" → "12 cuotas"
    .replace(/(\d+) ?x\b/g, '$1 cuotas').replace(/\bx ?(\d+)/g, '$1 cuotas');
  // Tramos: lo que la barra rota (• · |) y lo que se lee como frase aparte
  // (" - ", " — ", ". ", " / ").
  const tramos = t.split(/ ?[•·|] ?| [-–—] | \/ |\. /);
  for (let i = 0; i < tramos.length; i++) {
    const tramo = tramos[i];
    for (const m of tramo.matchAll(SIN_INTERES)) {
      const pos = m.index ?? 0;
      const antes = tramo.slice(0, pos);
      const despues = tramo.slice(pos + m[0].length);
      let duenos: number[] = [];
      const listaAntes = new RegExp(`(?:^|[^\\d$.,/])(${LISTA})${DESPUES_DE_LISTA}$`).exec(antes);
      const listaDespues = new RegExp(`^ ?[:,]? ?(?:hasta )?(?:en )?(?:hasta )?(${LISTA})(?! ?(?:mil|%|hs?\\b|horas?|dias?|meses?|anos?))`).exec(despues);
      // "Hasta 12 cuotas fijas sin interés en 3 y 6": si antes dijo "fijas" y
      // después viene una lista, el "sin interés" es de la que sigue.
      if (listaAntes && !(listaAntes[2] && listaDespues)) duenos = numerosDe(listaAntes[1]);
      else if (listaDespues) duenos = numerosDe(listaDespues[1]);
      else if (!/\d/.test(tramo) && i > 0) {
        const otras = (antes + ' ' + despues).split(/[^a-z]+/).filter((w) => w && !PALABRAS_SIN_SUJETO.has(w));
        if (otras.length === 0) {
          const previas = [...tramos[i - 1].matchAll(new RegExp(`(${LISTA})\\s*(?:cuotas?|pagos?)\\b(?!\\s+fijas?)`, 'g'))];
          if (previas.length) duenos = numerosDe(previas[previas.length - 1][1]);
        }
      }
      if (duenos.some((n) => n >= 12)) return true;
    }
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
  // Solo lo inequívoco lo reemplaza: un "dudoso" puede ser un falso positivo
  // y no puede tapar un cartel legítimo en vivo (se confirma al guardarlo).
  if (!texto || revisarCartel(texto).bloqueantes.length > 0) return CARTEL_PROMO_POR_DEFECTO;
  return texto;
}
