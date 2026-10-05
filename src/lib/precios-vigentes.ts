// ────────────────────────────────────────────────────────────────────────────
// ¿Un presupuesto quedó con precios viejos?
//
// Cada ítem guarda el precio con el que se cotizó; el catálogo tiene el de hoy.
// Acá se re-cotiza el presupuesto EN MEMORIA con las mismas funciones que usa el
// cotizador (oferta, cristal por ojo, par gratis del 2x1, teñido) y se compara
// ítem por ítem. No hay una cuenta propia: si el cotizador le pusiera hoy otro
// precio a un renglón, ese renglón está viejo.
//
// Módulo PURO: sin prisma ni fetch. El servicio le pasa el pedido con cada
// `item.product` ya leído del catálogo en vivo.
// ────────────────────────────────────────────────────────────────────────────

import { precioConOferta } from '@/lib/precio-oferta';
import {
    isCrystal,
    isTeñidoAddon,
    recalculateCrystalPrices,
    applyTeñidoPromoDiscount,
    safePrice,
} from '@/lib/promo-utils';
import { calculateQuoteTotals } from '@/services/PricingService';

export interface FilaDePrecio {
    itemId: string;
    nombre: string;
    ojo: string | null;
    cantidad: number;
    cotizado: number;
    hoy: number;
}

export interface ComparacionDePrecios {
    desactualizado: boolean;
    /** Solo los renglones cuyo precio cambió. */
    filas: FilaDePrecio[];
    itemsTotales: number;
    listaCotizada: number;
    listaHoy: number;
    /** listaHoy − listaCotizada: lo que haría falta de descuento especial para respetar el precio anterior. */
    diferencia: number;
    efectivoCotizado: number;
    efectivoHoy: number;
    /** Precio de hoy de cada renglón (todos, cambien o no), por id de OrderItem. */
    preciosNuevos: Record<string, number>;
    cotizadoEl: string | null;
}

/** Diferencias de centavos por redondeo no son un precio viejo. */
const TOLERANCIA_PESOS = 1;

const nombreDe = (it: any): string => {
    const marca = (it.product?.brand || it.productBrandSnapshot || '').trim();
    const nombre = (it.product?.name || it.productNameSnapshot || 'Producto').trim();
    return marca && !nombre.toLowerCase().includes(marca.toLowerCase()) ? `${marca} ${nombre}` : nombre;
};

const aCarrito = (items: any[]) => items.map(it => ({
    productId: it.productId || null,
    product: it.product || { price: it.price },
    quantity: it.quantity,
    customPrice: it.price,
    eye: it.eye ?? null,
    framePosition: it.framePosition ?? null,
}));

export function compararPreciosVigentes(
    order: {
        markup?: number | null;
        discountCash?: number | null;
        specialDiscount?: number | null;
        createdAt?: Date | string | null;
        items: any[];
    },
    tintStylePrices: Record<string, number> = {},
): ComparacionDePrecios {
    const originales = order.items || [];
    // Copias: las funciones del cotizador mutan `price` en el lugar.
    const hoy = originales.map(it => ({ ...it, price: it.price }));

    for (const it of hoy) {
        const p = it.product;
        // Sin producto (se borró del catálogo) no hay precio de hoy: queda como está.
        if (!p) continue;
        // Cristales y teñido los pone el motor de abajo (por ojo, 2x1, bonificación).
        if (isCrystal(p) || isTeñidoAddon(p)) continue;
        it.price = safePrice(precioConOferta(p).final);
    }
    recalculateCrystalPrices(hoy);
    applyTeñidoPromoDiscount(hoy, tintStylePrices);

    const filas: FilaDePrecio[] = [];
    const preciosNuevos: Record<string, number> = {};
    originales.forEach((it, i) => {
        const cotizado = Math.round(safePrice(it.price));
        const actual = Math.round(safePrice(hoy[i].price));
        preciosNuevos[it.id] = actual;
        if (Math.abs(actual - cotizado) >= TOLERANCIA_PESOS) {
            filas.push({
                itemId: it.id,
                nombre: nombreDe(it),
                ojo: it.eye || null,
                cantidad: it.quantity || 1,
                cotizado,
                hoy: actual,
            });
        }
    });

    const totales = (items: any[]) => calculateQuoteTotals(
        aCarrito(items), order.markup || 0, order.discountCash || 0, [], order.specialDiscount || 0,
    );
    const antes = totales(originales);
    const despues = totales(hoy);

    return {
        desactualizado: filas.length > 0,
        filas,
        itemsTotales: originales.length,
        listaCotizada: Math.round(antes.subtotalWithMarkup),
        listaHoy: Math.round(despues.subtotalWithMarkup),
        diferencia: Math.round(despues.subtotalWithMarkup - antes.subtotalWithMarkup),
        efectivoCotizado: Math.round(antes.totalCash),
        efectivoHoy: Math.round(despues.totalCash),
        preciosNuevos,
        cotizadoEl: order.createdAt ? new Date(order.createdAt).toISOString() : null,
    };
}

/** El rechazo del servidor cuando se intenta pasar a venta un presupuesto con precios viejos. */
export class PreciosDesactualizadosError extends Error {
    code = 'PRECIOS_DESACTUALIZADOS' as const;
    comparacion: ComparacionDePrecios;
    constructor(comparacion: ComparacionDePrecios) {
        super('Este presupuesto tiene precios desactualizados: actualizalos antes de cobrar o pasarlo a venta. Para respetar el precio anterior, un administrador puede aplicar un descuento especial.');
        this.comparacion = comparacion;
    }
}
