/**
 * Texto canónico de la garantía de adaptación.
 *
 * Es una promesa comercial: lo que decimos acá nos obliga. Estaba escrito a mano
 * en la home, en /promo, en las landings, en el FAQ, en el blog y en
 * /politicas-de-cambio, y las versiones ya no decían lo mismo entre sí — algunas
 * prometían "garantía total" sin plazo ni requisito de receta, y otras ampliaban
 * el alcance a cristales que la política publicada no cubre. Cuando cambien las
 * condiciones se toca SOLO este archivo.
 *
 * La versión que manda es la de /politicas-de-cambio: es la única publicada como
 * política y la más restrictiva. Ante cualquier duda, el marketing se alinea a
 * ella, nunca al revés.
 *
 * Cómo elegir qué exportar:
 * - `BADGE` / `TITULO`: rótulos cortos (hero, nav, tarjetas). Prometen poco a
 *   propósito; siempre tienen que poder llevar al detalle.
 * - `RESUMEN`: una frase con el alcance y el plazo. Para tarjetas de beneficios.
 * - `REQUISITO`: la letra chica de la receta. Va junto al RESUMEN en cualquier
 *   lugar donde se prometa el cambio sin costo.
 * - `CONDICIONES`: párrafo formal de la página de políticas.
 * - `ALCANCE`: qué cristales entran y cuáles NO.
 */

/** Días desde la entrega para reclamar la garantía. */
export const GARANTIA_PLAZO_DIAS = 30;

/** Máximo admitido entre la receta original y la nueva que exige la garantía. */
export const GARANTIA_DIAS_ENTRE_RECETAS = 90;

export const GARANTIA_ADAPTACION = {
  plazoDias: GARANTIA_PLAZO_DIAS,
  diasEntreRecetas: GARANTIA_DIAS_ENTRE_RECETAS,

  /** Encabezado de sección. */
  TITULO: "Garantía de adaptación",

  /** Rótulo corto con el plazo. Hero, nav, chips. */
  BADGE: `Garantía de adaptación ${GARANTIA_PLAZO_DIAS} días`,

  /**
   * Qué cristales cubre y cuáles no. El "no" es tan importante como el "sí":
   * omitirlo fue lo que hizo que varias piezas prometieran la garantía sobre
   * monofocales comunes.
   */
  ALCANCE:
    "La garantía cubre los cristales multifocales Varilux, Kodak y Sygnus, los multifocales " +
    "Smart Free, y los monofocales Super Blue (monofocales con filtro de luz azul). " +
    "Los demás cristales no tienen garantía de adaptación.",

  /** Una frase, en segunda persona. Para tarjetas de beneficios y bajadas. */
  RESUMEN:
    `Si no te adaptás a tus cristales con garantía dentro de los primeros ` +
    `${GARANTIA_PLAZO_DIAS} días, te los cambiamos sin costo.`,

  /** Letra chica. Nunca prometer el cambio sin acompañarlo de esto. */
  REQUISITO:
    `Para hacerla efectiva hay que presentar una receta nueva de tu oftalmólogo, ` +
    `emitida a menos de ${GARANTIA_DIAS_ENTRE_RECETAS} días de la anterior. ` +
    `El cambio se puede hacer una sola vez.`,

  /**
   * Párrafo de /politicas-de-cambio, en el registro formal ("el paciente") que usa
   * el resto de esa página. Es el texto con valor de política.
   */
  CONDICIONES:
    `Si el paciente no logra adaptarse dentro de los primeros ${GARANTIA_PLAZO_DIAS} días, ` +
    `nos comprometemos a reemplazar los cristales sin costo adicional, por única vez. Para ` +
    `hacer efectiva esta garantía, será indispensable la presentación de una nueva receta ` +
    `emitida por el médico oftalmólogo tratante (no deben transcurrir más de ` +
    `${GARANTIA_DIAS_ENTRE_RECETAS} días entre ambas recetas).`,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Qué cristal tiene garantía y cuál no
//
// El alcance de arriba está en prosa, para leerlo. Esto es lo mismo pero
// ejecutable, para poder decírselo al cliente cristal por cristal en la
// confirmación de compra. Las dos cosas viven en este archivo a propósito: si
// cambia la política, cambian juntas o no cambian.
//
// Se decide por marca y por línea, que es como está organizado el catálogo:
// verificado contra la base el 18/8/2026.
// ────────────────────────────────────────────────────────────────────────────

/** Marcas cuyos cristales tienen garantía en todas sus líneas. */
const MARCAS_CON_GARANTIA = ['varilux', 'mi primer varilux', 'kodak', 'sygnus'];

/**
 * Dentro de la marca Smart conviven cristales con garantía y sin ella: los
 * SMART FREE y el Super Blue la tienen; los "Multifocal NEW (BASE)",
 * "Multifocal ONE (estandar)", el Ocupacional y el Polarizado de sol, no.
 * Por eso Smart se resuelve por nombre y no por marca.
 */
const LINEAS_CON_GARANTIA = ['smart free', 'super blue'];

/** Categorías que NO son cristales: un armazón no tiene garantía de adaptación. */
const CATEGORIAS_QUE_NO_SON_CRISTAL = ['armazón', 'armazon', 'lentes de sol', 'lentes de contacto', 'tratamiento'];

export interface ItemConGarantia {
    productNameSnapshot?: string | null;
    productBrandSnapshot?: string | null;
    productCategorySnapshot?: string | null;
    product?: { name?: string | null; brand?: string | null; category?: string | null } | null;
}

/** ¿Este ítem es un cristal? (lo demás no lleva garantía de adaptación) */
export function esCristal(item: ItemConGarantia): boolean {
    const cat = `${item.product?.category || item.productCategorySnapshot || ''}`.toLowerCase();
    if (!cat) return false;
    if (CATEGORIAS_QUE_NO_SON_CRISTAL.some(c => cat.includes(c))) return false;
    return true;
}

/**
 * ¿Este cristal tiene garantía de adaptación?
 *
 * Devuelve false ante la duda (marca desconocida, ítem sin datos): prometer una
 * garantía que no existe es peor que no mencionarla — la promesa por escrito
 * nos obliga. Ver la nota del encabezado del archivo.
 */
export function cristalTieneGarantia(item: ItemConGarantia): boolean {
    if (!esCristal(item)) return false;
    const nombre = `${item.product?.name || item.productNameSnapshot || ''}`.toLowerCase();
    // El snapshot como respaldo: cuando el producto se borra del catálogo, `product`
    // viene null y solo sobreviven los *Snapshot. Sin esto, un Varilux de un pedido
    // viejo salía "SIN garantía" — un falso negativo que le niega al cliente una
    // garantía que sí tiene.
    const marca = `${item.product?.brand || item.productBrandSnapshot || ''}`.toLowerCase();
    if (LINEAS_CON_GARANTIA.some(l => nombre.includes(l))) return true;
    return MARCAS_CON_GARANTIA.some(m => marca === m || marca.includes(m));
}

/** Los cristales del pedido, separados según tengan garantía o no. */
export function garantiaDeLosCristales(items: ItemConGarantia[]): {
    conGarantia: string[];
    sinGarantia: string[];
} {
    const nombre = (it: ItemConGarantia) =>
        `${it.product?.name || it.productNameSnapshot || 'Cristal'}`.trim();
    const cristales = (items || []).filter(esCristal);
    return {
        conGarantia: cristales.filter(cristalTieneGarantia).map(nombre),
        sinGarantia: cristales.filter(it => !cristalTieneGarantia(it)).map(nombre),
    };
}

/**
 * Versión larga para secciones de contenido: alcance + promesa + letra chica.
 * Es la única forma completa; usar esta cuando hay lugar para tres oraciones.
 */
export const GARANTIA_TEXTO_LARGO =
  `${GARANTIA_ADAPTACION.ALCANCE} ${GARANTIA_ADAPTACION.RESUMEN} ${GARANTIA_ADAPTACION.REQUISITO}`;

/**
 * Versión corta para descripciones de una línea (tarjetas de beneficio, metas).
 * No incluye el requisito de receta, así que solo va donde el detalle está a un
 * clic — nunca como única mención de la garantía en una página.
 */
export const GARANTIA_TEXTO_CORTO = GARANTIA_ADAPTACION.RESUMEN;

/** Pregunta y respuesta del FAQ (visible y JSON-LD). */
export const GARANTIA_FAQ = {
  q: "¿Tienen garantía los cristales multifocales?",
  a:
    `Sí. Tienen garantía de adaptación los multifocales Varilux, Kodak y Sygnus, los ` +
    `multifocales Smart Free, y los monofocales Super Blue. Si no te adaptás dentro de los ` +
    `primeros ${GARANTIA_PLAZO_DIAS} días, te cambiamos los cristales sin costo, por única ` +
    `vez. Es requisito presentar una nueva receta emitida por tu oftalmólogo, y entre ambas ` +
    `recetas no deben pasar más de ${GARANTIA_DIAS_ENTRE_RECETAS} días. Los demás cristales ` +
    `no tienen garantía de adaptación.`,
} as const;
