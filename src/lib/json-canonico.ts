/**
 * Compara valores JSON sin depender del orden de las claves.
 *
 * Por qué existe: lo que se guarda en una columna `Json` (jsonb) vuelve de
 * Postgres con las claves de cada objeto en OTRO orden del que las escribió el
 * código (por largo y después alfabético). Un `JSON.stringify` directo entre lo
 * guardado y lo recién armado acusa diferencias que no existen: el 16/10/2026
 * el robot de Vitolen devolvía a revisión TODOS los borradores por eso.
 */
export function canonico(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(canonico);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map(k => [k, canonico((v as Record<string, unknown>)[k])]));
    return v;
}

/** `JSON.stringify` con las claves ordenadas: igual contenido ⇒ igual texto. */
export const jsonCanonico = (v: unknown) => JSON.stringify(canonico(v ?? null));

export const mismoJson = (a: unknown, b: unknown) => jsonCanonico(a) === jsonCanonico(b);
