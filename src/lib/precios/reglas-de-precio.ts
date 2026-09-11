/**
 * LAS REGLAS DE PRECIO DE ISHTAR, en un solo lugar y del lado del servidor.
 *
 * Hasta el 11/9/2026 vivían solo en scripts sueltos que alguien tenía que
 * acordarse de correr: la pantalla de edición de productos guardaba cualquier
 * precio sin mirar nada. Ahora el guardado las evalúa (ProductService /
 * PUT /api/products/[id]) y, si alguna se incumple, NO lo bloquea: pide
 * confirmación explícita. Son decisiones de la dueña, no errores de tipeo — un
 * candado duro la trabaría a ella misma cuando decide a propósito.
 *
 * 1. "A los más vendidos no les bajamos el precio por nada" (10/9/2026). Se toma
 *    "más vendido" como "tiene ventas": un producto que ya se vendió tiene
 *    clientes que lo compraron a ese precio.
 * 2. Piso de markup ×2,5 en cristales y tratamientos (31/8/2026).
 */

export const PISO_MARKUP_CRISTALES = 2.5;

export interface CambioDePrecio {
    precioActual: number | null | undefined;
    precioNuevo: number | null | undefined;
    costo: number | null | undefined;
    categoria: string | null | undefined;
    ventas: number;
}

/** Devuelve los avisos que requieren confirmación; vacío = se guarda sin preguntar. */
export function avisosDeCambioDePrecio(c: CambioDePrecio): string[] {
    const avisos: string[] = [];
    const actual = Number(c.precioActual) || 0;
    const nuevo = Number(c.precioNuevo);
    if (!Number.isFinite(nuevo)) return avisos;
    if (c.ventas > 0 && nuevo < actual) {
        avisos.push(
            `Este producto tiene ${c.ventas} venta(s) y le estás BAJANDO el precio ` +
            `($${Math.round(actual).toLocaleString('es-AR')} → $${Math.round(nuevo).toLocaleString('es-AR')}). ` +
            `Regla: a los más vendidos no se les baja el precio.`);
    }
    const costo = Number(c.costo) || 0;
    if (costo > 0 && (c.categoria === 'Cristal' || c.categoria === 'Tratamiento') && nuevo / costo < PISO_MARKUP_CRISTALES) {
        avisos.push(
            `Queda con markup ×${(nuevo / costo).toFixed(2)}, por debajo del piso de ×${PISO_MARKUP_CRISTALES} ` +
            `(costo $${Math.round(costo).toLocaleString('es-AR')}).`);
    }
    return avisos;
}
