import { cristalVitolenPorNombre } from './catalogo';

/**
 * EL SEGUNDO PAR DE VITOLEN NO ES GRATIS: se factura al 20 % del precio de
 * lista base (lente + tratamiento) más el calibrado. Bases de la promo del
 * 30/9/2026 (docs/vitolen-pedidos-y-promos.md). Es distinto del 2x1 del CRM,
 * que espera el segundo par en $0 (regla de Optovisión y Grupo Óptico).
 *
 * Acá vive la cuenta de lo que ESPERAMOS que Vitolen facture por un 2º par,
 * para que el cruce pueda decir "vino más caro" sin acusar en falso.
 */
export const PORCENTAJE_SEGUNDO_PAR = 0.20;

/** Cuánto debería facturar Vitolen por el 2º par de un cristal de lista. Puro. */
export function importeEsperadoSegundoPar(
    precioLista: number,
    lab: { calibrado: number; iva: number },
): number {
    const lente = precioLista * PORCENTAJE_SEGUNDO_PAR;
    return Math.round((lente + lab.calibrado) * (1 + lab.iva / 100));
}

/**
 * Lo que espera pagarse por el 2º par a partir del cristal vendido: hace falta
 * el precio de lista (pelado) del producto, que está en `Product.baseCost`.
 * Devuelve null si el cristal no es de Vitolen o no hay pelado.
 */
export function importeEsperadoSegundoParDe(
    nombreCristal: string | null | undefined,
    baseCost: number | null | undefined,
    lab: { calibrado: number; iva: number },
): number | null {
    if (!cristalVitolenPorNombre(nombreCristal)) return null;
    if (baseCost == null || !Number.isFinite(baseCost) || baseCost <= 0) return null;
    return importeEsperadoSegundoPar(baseCost, lab);
}

/**
 * ¿El laboratorio cobró el 2º par por encima de lo prometido? Tolerancia del
 * 5 %: la lista cambia de precio en el medio y el calibrado se redondea.
 */
export function segundoParCobradoDeMas(facturado: number, esperado: number, tolerancia = 0.05): boolean {
    return facturado > esperado * (1 + tolerancia);
}
