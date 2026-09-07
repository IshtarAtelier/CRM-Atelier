/**
 * "Esta persona ya vino al local."
 *
 * Para qué sirve: el segundo toque del embudo (a los 4 días) es una invitación
 * a pasar por el local. Mandársela a alguien que ya vino es el error que más
 * se nota — se lee como que nadie está prestando atención, y es exactamente lo
 * que hace que un cliente deje de contestar. Pedido de Ishtar, 7/9/2026.
 *
 * Cómo se marca, por tres vías (en orden de confiabilidad):
 *
 *  1. EL BOTÓN "VISITA" de la ficha, que el equipo YA usa: crea una
 *     `Interaction type='STORE_VISIT'`. Es la señal buena y la que más datos
 *     tiene (268 visitas registradas al 7/9/26). No hizo falta inventar nada:
 *     ya existía y nadie la estaba leyendo desde el embudo.
 *
 *  2. LA ETIQUETA "Visita Showroom", que desde el 7/9/26 se pone SOLA al
 *     apretar ese botón (`ContactService.addInteraction`). Existía de antes
 *     —la usa el dashboard para separar ventas en local vs online— pero se
 *     ponía a mano y por eso casi no estaba. Se lee igual que la interacción
 *     para cubrir las fichas viejas que la tienen puesta a mano.
 *
 *  3. UN TURNO YA PASADO (`ClientTask type='TURNO'` con la fecha cumplida).
 *     Es la más floja: sacó turno y la hora pasó, pero puede no haber venido.
 *     Se usa igual porque el error es asimétrico: si nos equivocamos y NO le
 *     mandamos la invitación, recibe el toque siguiente y no se pierde nada;
 *     si nos equivocamos al revés, le estamos invitando al local a alguien que
 *     estuvo ahí ayer.
 *
 * Lo que esto NO hace: sacar a la persona del embudo. Alguien que vino y no
 * compró sigue siendo un lead y sigue recibiendo los demás toques — solo se
 * saltea la invitación. Para sacar a alguien del embudo están las etiquetas de
 * exclusión (`embudo.service.ts`).
 */

/**
 * El nombre EXACTO de la etiqueta que ya usa el dashboard para separar ventas
 * en local vs online. Si se cambia acá, hay que cambiarlo también en
 * `api/dashboard/route.ts`, que la compara por nombre.
 */
export const TAG_VISITA_LOCAL = 'Visita Showroom';

/** Se comparan en minúsculas y por CONTENIDO, para tolerar espacios y variantes viejas. */
export const TAGS_VISITO_LOCAL = ['visita showroom', 'vino al local', 'visito el local', 'visitó el local'] as const;

/** ¿Las etiquetas de esta ficha dicen que ya pasó por el local? */
export function tieneEtiquetaDeVisita(tagNames: string[]): boolean {
    return tagNames.some(t => {
        const n = t.toLowerCase();
        return TAGS_VISITO_LOCAL.some(v => n.includes(v));
    });
}
