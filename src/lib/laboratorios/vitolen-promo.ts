import { cristalVitolenPorNombre } from './vitolen-catalogo';
import { descuentoSegundoParHoya, type LineaDeCarrito } from '../promo-segundo-par-hoya';
import type { RolesDePares } from './roles-2x1';
import { cristalesPorArmazon } from '../order-frames';

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

/**
 * Qué par es el 1º y cuál el 2º de la promo del segundo par, con LA MISMA
 * regla con la que el CRM la aplica al cobrar (`descuentoSegundoParHoya`:
 * líneas que la encienden, mismo diseño o Tact, igual o menor valor — el caro
 * es el 1º, regla de Ishtar del 8/10/2026). Sin promo (Nulux + Tact, un solo
 * par, Mi Primer Hoya) devuelve null: no hay pendiente ni aviso que mostrar.
 * Sin armazón asignado, los pares se arman en orden (par 1 y 2). Puro.
 */
export function rolesDeLaPromoHoya(items: LineaDeCarrito[]): RolesDePares | null {
    const d = descuentoSegundoParHoya(items);
    if (!d.primerPar || !d.segundoPar) return null;
    // Qué PAR (armazón 1 o 2) es cada uno lo dice el único repartidor de la
    // venta (`cristalesPorArmazon`): por armazón asignado o, sin asignar, por el
    // orden del carrito. Antes, sin armazón, el 1º de la promo era "el par 1" a
    // ciegas: con el cristal barato primero en el carrito, el caro quedaba como
    // 2º par, Vitolen lo facturaba entero y el cruce reclamaba en falso
    // (auditoría 5, 15/10/2026).
    const porPar = cristalesPorArmazon({ items } as any);
    const parDe = (p: { indices: number[] }): number | null => {
        for (const [pair, its] of porPar) if (p.indices.some(i => (its as unknown[]).includes(items[i]))) return pair;
        return null;
    };
    const conCargo = parDe(d.primerPar);
    const sinCargo = parDe(d.segundoPar);
    if (!conCargo || !sinCargo || conCargo === sinCargo) return null;
    return {
        conCargo, sinCargo,
        porValor: d.primerPar.precio !== d.segundoPar.precio,
        valores: { [conCargo]: d.primerPar.precio, [sinCargo]: d.segundoPar.precio },
    };
}

/** El rol de un par según esos roles: null si no está en la promo (un 3er par, o sin promo). Puro. */
export function rolDeLaPromo(roles: RolesDePares | null, pair: number): 'PRIMER_PAR' | 'SEGUNDO_PAR' | null {
    if (!roles) return null;
    return pair === roles.sinCargo ? 'SEGUNDO_PAR' : pair === roles.conCargo ? 'PRIMER_PAR' : null;
}
