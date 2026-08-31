/**
 * Los números del briefing diario del equipo de venta.
 *
 * Son reglas de la dueña, no parámetros técnicos: viven acá con nombre para que
 * el día que cambien se cambien en un solo lugar y no haya que buscarlos entre
 * el texto del modal y la validación del endpoint.
 */

/** Presupuestos por día. Es un piso, no una meta. */
export const BRIEFING_MINIMO_PRESUPUESTOS = 15;

/** Tareas por día: un rango, porque cerrar 40 tareas en un día es no hacerlas. */
export const BRIEFING_TAREAS_MIN = 5;
export const BRIEFING_TAREAS_MAX = 10;

/**
 * Largo mínimo de lo que el vendedor escribe al final.
 *
 * Lo validan el modal (para avisar en el momento) y el endpoint (porque el
 * modal es del cliente y no se le cree). Por eso el número es uno solo.
 */
export const BRIEFING_MINIMO_TEXTO = 10;
