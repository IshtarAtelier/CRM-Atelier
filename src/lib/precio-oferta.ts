/**
 * PRECIO DE OFERTA ("precio tachado"), en UN SOLO LUGAR.
 *
 * El descuento se carga en /admin/web → "Precio de oferta (opcional)" y vive en
 * `Product.salePrice`. La regla siempre fue la misma —vale si está cargado, es
 * mayor a cero y es MENOR al precio de lista— pero estaba tipeada a mano en la
 * grilla de la tienda, en la ficha del producto, en los productos relacionados y
 * en el JSON-LD. El cotizador directamente no la miraba: un armazón rebajado a
 * $160.000 se presupuestaba a $215.000, y la clienta veía en la web un precio y
 * en el presupuesto otro.
 *
 * Todo lo que muestre o cobre el precio de un producto entra por acá.
 */

export interface PrecioConOferta {
    /** Precio de lista, el que se tacha cuando hay oferta. */
    lista: number;
    /** El que se cobra: el de oferta si la hay, si no el de lista. */
    final: number;
    /** ¿Tiene una rebaja de verdad cargada? */
    enOferta: boolean;
    /** Descuento redondeado, para el cartel "26% OFF". 0 si no hay oferta. */
    descuentoPct: number;
}

/** Lo mínimo que hace falta de un producto para saber su precio. */
export interface ProductoConPrecio {
    price?: number | null;
    salePrice?: number | null;
}

/**
 * Resuelve el precio de un producto teniendo en cuenta su oferta.
 *
 * Un `salePrice` mayor o igual al de lista NO es una oferta: se ignora en vez de
 * mostrar un "0% OFF" o, peor, un aumento disfrazado de rebaja.
 */
export function precioConOferta(producto: ProductoConPrecio | null | undefined): PrecioConOferta {
    const lista = Number(producto?.price) || 0;
    const oferta = Number(producto?.salePrice) || 0;
    const enOferta = oferta > 0 && oferta < lista;
    return {
        lista,
        final: enOferta ? oferta : lista,
        enOferta,
        descuentoPct: enOferta ? Math.round((1 - oferta / lista) * 100) : 0,
    };
}

/** Atajo para cuando solo hace falta el número que se cobra. */
export function precioFinal(producto: ProductoConPrecio | null | undefined): number {
    return precioConOferta(producto).final;
}
