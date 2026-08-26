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

/**
 * Respaldo para cuando NO se pudo leer LaboratoryConfig (la fuente de verdad:
 * se edita en Configuración → Laboratorios).
 *
 * Estaba escrito a mano en cuatro lugares distintos y con un valor viejo:
 * $15.000, cuando el calibrado de Optovisión es $23.000 desde hace rato. Ese
 * respaldo lo usaba el cruce de costos para valuar el par bonificado de un 2x1,
 * así que TODA venta 2x1 se comparaba contra un costo $9.500 más bajo del real
 * y aparecían sobrecostos que no existían. Un número mágico repetido siempre
 * termina así: se actualiza en un lugar y queda viejo en los otros tres.
 */
export const CALIBRADO_POR_DEFECTO = 23000;
export const IVA_POR_DEFECTO = 21;

/** Lo que cuesta el par bonificado de un 2x1: solo calibrado, con su IVA. */
export function costoParBonificado(lab?: LabCostConfig): number {
    // Una fila de LaboratoryConfig creada y nunca configurada queda con los
    // defaults del schema (calibrado 0.0, iva 0.0). Eso NO significa "calibrado
    // gratis": significa que la config falta, y valen los respaldos — si no, el
    // par bonificado de todo 2x1 de ese lab se valuaba en $0 y llovían alertas
    // falsas de sobrecosto. Un 0 PARCIAL sí es legítimo (Grupo Óptico tiene
    // calibrado 7.000 con IVA 0): solo el 0/0 total cae al respaldo.
    const configurado = !!lab && !!(lab.calibrado || lab.iva);
    const calibrado = configurado ? (lab!.calibrado || 0) : CALIBRADO_POR_DEFECTO;
    const iva = configurado ? (lab!.iva || 0) : IVA_POR_DEFECTO;
    return Math.round(calibrado * (1 + iva / 100));
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
