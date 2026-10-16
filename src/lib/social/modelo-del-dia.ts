/**
 * Qué modelo sale hoy en el feed (cron /api/cron/social-feed?que=modelo).
 *
 * Los días pares del calendario (contados desde el 1/1/2026) sale uno de
 * Agostina; los impares, uno de Massaru. Dentro de cada carril se avanza una
 * posición cada dos días (cada carril publica día por medio), módulo su largo.
 * Si un carril está vacío, sale el otro todos los días. Determinístico a
 * propósito: se sabe de antemano qué sale mañana y un problema se puede
 * reproducir (mismo criterio que las stories).
 */
export const ORDEN_CARRILES = ['agostina', 'massaru'] as const;

export function modeloDelDia(
    carriles: Record<string, { id: string }[]>,
    dia: number,
): { carril: string; id: string } | null {
    const orden = ORDEN_CARRILES.filter(c => carriles[c]?.length);
    if (!orden.length) return null;
    const carril = orden[((dia % orden.length) + orden.length) % orden.length];
    const lista = carriles[carril];
    const posicion = Math.floor(dia / orden.length);
    return { carril, id: lista[((posicion % lista.length) + lista.length) % lista.length].id };
}
