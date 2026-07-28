/**
 * Fórmula única del costo de un cristal.
 *
 * costo final = (costo pelado de lista + calibrado del lab) × (1 + IVA%)
 *
 * El "costo pelado" (`baseCost`) es lo que factura el laboratorio de lista. El costo
 * final (`cost`) es el que usan reportes y ventas. Se guardan los dos: sin el pelado
 * no hay forma de recalcular sin volver a aplicar la fórmula sobre un costo que ya
 * la tenía aplicada (que era el bug de duplicación del botón "Calcular Final").
 */

export interface LabCostConfig {
    name: string;
    calibrado?: number | null;
    iva?: number | null;
}

export interface LensCostOptions {
    /** Par bonificado: el lab calibra dos pares, así que el calibrado va doble. */
    is2x1?: boolean;
    /** Los tratamientos no llevan calibrado. */
    skipCalibrado?: boolean;
}

export function findLabConfig(labs: LabCostConfig[], labName?: string | null): LabCostConfig | undefined {
    const target = (labName || '').trim().toUpperCase();
    if (!target) return undefined;
    return labs.find(l => l.name.toUpperCase() === target);
}

/** Desglose de la fórmula, para mostrarlo en pantalla y que no sea una caja negra. */
export function breakdownLensCost(baseCost: number, lab: LabCostConfig | undefined, opts: LensCostOptions = {}) {
    const base = Number.isFinite(baseCost) ? baseCost : 0;
    const calibradoUnit = opts.skipCalibrado ? 0 : (lab?.calibrado || 0);
    const calibrado = opts.is2x1 ? calibradoUnit * 2 : calibradoUnit;
    const iva = lab?.iva || 0;
    const final = Math.round((base + calibrado) * (1 + iva / 100));
    return { base, calibrado, iva, final };
}

/** Costo final a partir del pelado. Si el lab no tiene fórmula cargada, el final es el pelado. */
export function computeFinalLensCost(baseCost: number, lab: LabCostConfig | undefined, opts: LensCostOptions = {}): number {
    if (!lab) return Math.round(Number.isFinite(baseCost) ? baseCost : 0);
    return breakdownLensCost(baseCost, lab, opts).final;
}
