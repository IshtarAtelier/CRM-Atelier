/**
 * "Esta persona ya vino al local."
 *
 * Para qué sirve: el segundo toque del embudo (a los 4 días) es una invitación
 * a pasar por el local. Mandársela a alguien que ya vino es el error que más
 * se nota — se lee como que nadie está prestando atención, y es exactamente lo
 * que hace que un cliente deje de contestar. Pedido de Ishtar, 7/9/2026.
 *
 * Cómo se marca, por dos vías:
 *
 *  1. UNA ETIQUETA en la ficha, puesta por una persona (`TAGS_VISITO_LOCAL`).
 *     Es el registro confiable: alguien lo vio entrar. Mismo criterio que
 *     `no-cliente.ts` — una decisión humana, reversible, sin migrar nada.
 *
 *  2. UN TURNO YA PASADO (`ClientTask type='TURNO'` con la fecha cumplida).
 *     Es una señal más floja: sacó turno, y la hora ya pasó. Puede no haber
 *     venido. Se usa igual porque el error es asimétrico: si nos equivocamos
 *     y NO le mandamos la invitación, recibe el toque siguiente igual y no se
 *     pierde nada; si nos equivocamos al revés, le estamos invitando al local
 *     a alguien que estuvo ahí ayer.
 *
 * Lo que esto NO hace: sacar a la persona del embudo. Alguien que vino y no
 * compró sigue siendo un lead y sigue recibiendo los demás toques — solo se
 * saltea la invitación. Para sacar a alguien del embudo están las etiquetas de
 * exclusión (`embudo.service.ts`).
 */

/** Se comparan en minúsculas y por CONTENIDO: "Vino al local (jueves)" también cae. */
export const TAGS_VISITO_LOCAL = ['vino al local', 'visito el local', 'visitó el local'] as const;

/** ¿Las etiquetas de esta ficha dicen que ya pasó por el local? */
export function tieneEtiquetaDeVisita(tagNames: string[]): boolean {
    return tagNames.some(t => {
        const n = t.toLowerCase();
        return TAGS_VISITO_LOCAL.some(v => n.includes(v));
    });
}
