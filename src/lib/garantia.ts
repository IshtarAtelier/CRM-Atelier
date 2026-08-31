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
    "La garantía cubre los cristales multifocales Varilux y los monofocales Super Blue " +
    "(monofocales con filtro de luz azul). Los demás cristales monofocales no tienen " +
    "garantía de adaptación.",

  /** Una frase, en segunda persona. Para tarjetas de beneficios y bajadas. */
  RESUMEN:
    `Si no te adaptás a tus multifocales Varilux o a tus monofocales Super Blue dentro de ` +
    `los primeros ${GARANTIA_PLAZO_DIAS} días, te cambiamos los cristales sin costo.`,

  /** Letra chica. Nunca prometer el cambio sin acompañarlo de esto. */
  REQUISITO:
    `Para hacerla efectiva hay que presentar una receta nueva de tu oftalmólogo, ` +
    `emitida a menos de ${GARANTIA_DIAS_ENTRE_RECETAS} días de la anterior.`,

  /**
   * Párrafo de /politicas-de-cambio, en el registro formal ("el paciente") que usa
   * el resto de esa página. Es el texto con valor de política.
   */
  CONDICIONES:
    `Si el paciente no logra adaptarse dentro de los primeros ${GARANTIA_PLAZO_DIAS} días, ` +
    `nos comprometemos a reemplazar los cristales sin costo adicional. Para hacer efectiva ` +
    `esta garantía, será indispensable la presentación de una nueva receta emitida por el ` +
    `médico oftalmólogo tratante (no deben transcurrir más de ${GARANTIA_DIAS_ENTRE_RECETAS} ` +
    `días entre ambas recetas).`,
} as const;

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

/**
 * LOS TÉRMINOS DEL CAMBIO, dictados por Ishtar el 31/8/2026.
 *
 * Son las condiciones que hoy se explican de palabra en el mostrador y que, por
 * no estar escritas, terminan discutiéndose cuando el cliente vuelve. Cada una
 * define un límite concreto de la garantía: qué habilita el cambio, sobre qué
 * producto se hace, qué pasa con la seña y qué queda a criterio de la óptica.
 *
 * Van al pie del presupuesto y de la confirmación de compra, con link a
 * /politicas-de-cambio. Que el cliente los tenga ANTES de pagar es el punto.
 */
export const TERMINOS_CAMBIO = [
    {
        titulo: 'El cambio es únicamente por cambio de receta',
        texto:
            `La garantía se hace efectiva solo cuando el oftalmólogo emite una receta nueva. ` +
            `Entre una receta y la otra no pueden pasar más de ${GARANTIA_DIAS_ENTRE_RECETAS} días.`,
    },
    {
        titulo: 'Se repite el mismo cristal, en el mismo armazón',
        texto:
            'El cambio se hace sobre el mismo producto y con el mismo armazón. Si se compró un ' +
            'Orma blanco con Crizal Rock, se vuelve a hacer exactamente ese cristal. Cambiar a otro ' +
            'cristal, otro material u otro tratamiento no entra en la garantía: se consulta, y tanto ' +
            'la posibilidad de hacerlo como el costo quedan a criterio de la óptica.',
    },
    {
        titulo: 'Mi Primer Varilux y Mi Primer Kodak: hasta 1,50 de adición',
        texto:
            'Estas promociones son para quien usa su primer multifocal, y por eso admiten hasta ' +
            '1,50 de adición. Si la receta nueva supera esa adición, el cristal deja de encuadrar ' +
            'en la promoción: se pierde el 50% de descuento y hay que abonar la diferencia que ' +
            'corresponda al cristal que sí cubre esa graduación.',
    },
    {
        titulo: 'Las señas no se devuelven',
        texto:
            'La seña de un producto no tiene devolución. Se puede cambiar por otro producto ' +
            'únicamente si el original no fue confeccionado a medida para la persona. En todos los ' +
            'casos queda a criterio de la empresa.',
    },
    {
        titulo: 'Antes de dudar de la receta, te revisamos acá',
        texto:
            'Si sentís que la graduación no te resulta cómoda, traé los anteojos: los revisamos en ' +
            'el local sin cargo para verificar que estén hechos según la receta. Si el problema no ' +
            'está en el armado, corresponde volver al oftalmólogo para que ajuste la graduación en ' +
            'un turno nuevo.',
    },
] as const;

/** Los mismos términos en texto plano, para WhatsApp y PDFs. */
export const TERMINOS_CAMBIO_TEXTO = TERMINOS_CAMBIO
    .map(t => `• ${t.titulo}: ${t.texto}`)
    .join('\n');

/** Pregunta y respuesta del FAQ (visible y JSON-LD). */
export const GARANTIA_FAQ = {
  q: "¿Tienen garantía los cristales multifocales?",
  a:
    `Sí. Todos nuestros cristales multifocales Varilux, y los cristales Super Blue de ` +
    `monofocales, tienen garantía de adaptación. Si no te adaptás dentro de los primeros ` +
    `${GARANTIA_PLAZO_DIAS} días, te cambiamos los cristales sin costo. Es requisito ` +
    `presentar una nueva receta emitida por tu oftalmólogo, y entre ambas recetas no deben ` +
    `pasar más de ${GARANTIA_DIAS_ENTRE_RECETAS} días. Los demás cristales monofocales no ` +
    `tienen garantía de adaptación.`,
} as const;
