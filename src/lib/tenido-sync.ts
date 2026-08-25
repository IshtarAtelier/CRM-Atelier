// ────────────────────────────────────────────────────────────────────────────
// El teñido de un anteojo es UNO: el color, el grado y el armazón valen para
// los dos cristales del par (no existe teñir un ojo solo — Ishtar, 24/8/26).
//
// Los teñidos NUEVOS ya entran como una sola línea, así que no hay nada que
// sincronizar. Este módulo existe por los pedidos GUARDADOS ANTES, que tienen
// el teñido partido en dos líneas OD/OI: al editar cualquiera de las dos, el
// cambio se copia a su compañera — si no, quedaba OD Sepia y OI G15, y la
// fábrica no tiene cómo saber cuál es el bueno.
//
// Qué líneas son "el mismo teñido" lo decide `gruposDeTenido` (promo-utils),
// la única definición; acá solo se aplica el cambio al grupo entero.
// ────────────────────────────────────────────────────────────────────────────

import { gruposDeTenido, esLineaDeTenido } from './promo-utils';

/** Los campos que un teñido comparte entre sus líneas. */
export const CAMPOS_DE_TENIDO = ['crystalColor', 'crystalColorType', 'crystalColorNote', 'framePosition'] as const;

/**
 * Índices de todas las líneas que forman EL MISMO teñido que `idx` (lo
 * incluye). Para una línea que no es teñido, es solo ella.
 */
export function indicesDelMismoTenido(items: any[], idx: number): number[] {
    if (!esLineaDeTenido(items[idx])) return [idx];
    return gruposDeTenido(items).find(g => g.includes(idx)) ?? [idx];
}

/**
 * Aplica `cambios` a la línea `idx` y, si es un teñido, también a las demás
 * líneas del mismo teñido. Inmutable: devuelve un array nuevo (para setState).
 */
export function aplicarCambioDeLinea(items: any[], idx: number, cambios: Record<string, unknown>): any[] {
    const objetivo = new Set(indicesDelMismoTenido(items, idx));
    return items.map((it, i) => (objetivo.has(i) ? { ...it, ...cambios } : it));
}
