/**
 * CILINDRO PURO: una receta con cilindro y el esférico vacío es PLANO (0,00).
 *
 * En la receta escrita, un ojo de cilindro puro se anota "Neutro", "PL", "—" o
 * directamente sin esférico. Hasta el 22/10/2026 los robots de los tres
 * laboratorios leían ese vacío como "falta el esférico" y frenaban la carga
 * aunque la receta estaba bien (Faustino Garzón y Mariel Miguel, Grupo Óptico:
 * OD −3,50 × 5°, OI −2,75 × 5°). Sin cilindro, un esférico vacío SÍ es un dato
 * que falta. Puro.
 */
export function esfericoDeLaReceta(esferico: number | null, cilindro: number | null): { esferico: number | null; plano: boolean } {
    if (esferico !== null) return { esferico, plano: false };
    if (cilindro !== null && cilindro !== 0) return { esferico: 0, plano: true };
    return { esferico: null, plano: false };
}

/** El aviso que acompaña a un esférico tomado como plano, para que se vea en la revisión. */
export const avisoCilindroPuro = (lado: string) => `${lado}: cilindro puro (esférico vacío en la receta) → se carga esférico plano 0,00`;
