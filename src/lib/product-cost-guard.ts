/**
 * Guardia de costos del catálogo: ningún producto puede nacer ni quedar con costo $0.
 *
 * Regla de negocio (2026-07-17): un producto con costo en cero hace que los reportes
 * cuenten sus ventas con ganancia del 100% (report.service resuelve
 * `productCostSnapshot ?? product.cost ?? 0`), y la venta congela ese cero para
 * siempre en el snapshot. Hoy TODO el catálogo tiene costo real cargado; este guard
 * evita que vuelva a entrar un cero por el alta manual, la carga masiva o el CSV.
 */

export class InvalidCostError extends Error {
    constructor(label?: string | null) {
        super(
            `El producto${label ? ` "${label}"` : ''} necesita un costo mayor a $0. ` +
            'Sin costo real, los reportes cuentan la venta como ganancia pura. ' +
            'Cargá lo que costó (aunque sea aproximado) y volvé a guardar.'
        );
        this.name = 'InvalidCostError';
    }
}

/** Parsea y valida un costo. Devuelve el número si es > 0; si no, lanza InvalidCostError. */
export function requireValidCost(raw: unknown, label?: string | null): number {
    const value = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
    if (!Number.isFinite(value) || value <= 0) {
        throw new InvalidCostError(label);
    }
    return value;
}
