/**
 * UNA sola promo visible por ficha y por tarjeta (plan tienda, Fase 1.3,
 * 15/10/2026).
 *
 * Por qué existe: la ficha de receta mostraba "$123.250 / 15% OFF
 * transferencia / $136.000 tachado / 9% OFF / o $145.000 con tarjeta" y, sobre
 * la foto, un chip rojo "-9% OFF". Tres precios y dos descuentos para un solo
 * anteojo: el 9 % se refería al precio de lista y el 15 % al de transferencia,
 * pero se leían como si se sumaran. En sol y clip-on, donde hay un precio y es
 * claro, la gente entiende; en receta —la categoría que vende— no.
 *
 * La regla, en un solo lugar para que la ficha, las grillas, el carrusel del
 * home y el buscador digan lo mismo:
 *  · CON rebaja cargada (salePrice): el sello es la rebaja ("9% OFF"), y el
 *    precio grande se nombra "por transferencia" SIN el 15 %: la rebaja ya es
 *    la promo. Nada tachado: el tachado al lado de un sello es un segundo
 *    descuento a los ojos del cliente.
 *  · SIN rebaja: no hay sello y el precio grande dice "15% OFF por
 *    transferencia", que es la única condición que explica el número.
 *
 * Los NÚMEROS no se tocan: siguen saliendo de PricingService.vidrieraDeProducto.
 * Acá solo se decide qué etiqueta va al lado.
 */

export interface PromoVisible {
    /** El cartel de la rebaja real ("9% OFF") o null si no hay rebaja cargada. */
    sello: string | null;
    /** Qué se dice al lado del precio grande (ficha). */
    etiquetaTransferencia: string;
    /** Lo mismo, corto, para tarjetas y buscador. */
    etiquetaTransferenciaCorta: string;
}

export function promoVisible(
    v: { enOferta: boolean; descuentoPct: number },
    descuentoTransferenciaPct: number,
): PromoVisible {
    if (v.enOferta) {
        return {
            sello: `${v.descuentoPct}% OFF`,
            etiquetaTransferencia: 'por transferencia',
            etiquetaTransferenciaCorta: 'por transf.',
        };
    }
    return {
        sello: null,
        etiquetaTransferencia: `${descuentoTransferenciaPct}% OFF por transferencia`,
        etiquetaTransferenciaCorta: `${descuentoTransferenciaPct}% OFF transf.`,
    };
}
