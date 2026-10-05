/**
 * El filtro "Precio" de la tienda, en UN solo lugar: /tienda (vía
 * /api/store/products), /receta, /lentes-de-sol y /clip-on.
 *
 * Por qué existe (revisión del 5/10/2026): /receta, /lentes-de-sol y /clip-on
 * mostraban los botones de precio pero ninguno filtraba — cambiaba la URL y
 * la grilla quedaba igual. Y en /tienda el número de la comparación vivía
 * dentro de la ruta. Los rangos están en src/lib/constants/rangos-precio-tienda.ts.
 */
import { PricingService } from '@/services/PricingService';
import { precioFinal } from '@/lib/precio-oferta';
import { effectiveFramePrice } from '@/lib/checkout/checkout-pricing';

/**
 * El número de la tarjeta contra el que se compara el rango: al público, el
 * precio por transferencia (el grande); a un mayorista, su precio mayorista,
 * que es el que ve y el que se le cobra.
 */
export function precioParaRango(
    p: { price?: number | null; salePrice?: number | null; wholesalePrice?: number | null },
    descuentoTransferenciaPct: number,
    mayorista = false,
): number {
    if (mayorista) return effectiveFramePrice(p, true);
    return PricingService.preciosVidriera(precioFinal(p as any), descuentoTransferenciaPct).contado;
}

/**
 * El % por transferencia de /admin/web como lo usan las tarjetas: un valor
 * vacío o en 0 cae al 15 (TiendaClient y CategoryGrid hacen `|| 15`). Con
 * `?? 15` un 0 cargado filtraba por un número y la tarjeta mostraba otro.
 */
export function descuentoTransferenciaDe(valor: unknown): number {
    return Number(valor) || 15;
}

/** Los dos límites de la URL (`precioMin`, `precioMax`); 0 = sin límite. */
export function leerRangoPrecio(min?: string | null, max?: string | null): { min: number; max: number; activo: boolean } {
    const a = Number(min || 0) || 0;
    const b = Number(max || 0) || 0;
    return { min: a, max: b, activo: a > 0 || b > 0 };
}

/** ¿El precio entra en el rango? Los dos límites son inclusivos. */
export function dentroDelRango(valor: number, rango: { min: number; max: number }): boolean {
    if (rango.min > 0 && valor < rango.min) return false;
    if (rango.max > 0 && valor > rango.max) return false;
    return true;
}
