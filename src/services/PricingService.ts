import { isMultifocal2x1, isCrystal, isFrame, isAtelierFrame, safePrice, getCategoryKey } from '@/lib/promo-utils';

export interface CartItem {
    productId: string | null;
    product: any;
    quantity: number;
    price: number; // Snapshot or current price
}

export interface PricingResult {
    rawSubtotal: number;
    promoFrameDiscount: number;
    subtotal: number;
    subtotalWithMarkup: number;
    totalCash: number;
    appliedPromos: string[];
}

/**
 * PricingService unifica toda la lógica de cálculo de precios, descuentos y promociones.
 * Diseñado para ser escalable y modular.
 */
export class PricingService {
    /**
     * Calcula los totales de un presupuesto/orden.
     * @param items - Items del carrito
     * @param markup - Porcentaje de recargo (0-100)
     * @param discountCash - Porcentaje de descuento por efectivo (0-100)
     * @param availableProducts - Catálogo completo para cálculos de promedio (opcional)
     */
    static calculateTotals(
        items: CartItem[],
        markup: number = 0,
        discountCash: number = 0,
        availableProducts: any[] = []
    ): PricingResult {
        const rawSubtotal = items.reduce((sum, item) => sum + (safePrice(item.price) * (item.quantity || 1)), 0);
        
        let promoFrameDiscount = 0;
        const appliedPromos: string[] = [];

        // Lógica de 2x1 en multifocales (regla actual)
        const hasMultifocalPromo = items.some(
            it => isCrystal(it.product) && isMultifocal2x1(it.product)
        );

        if (hasMultifocalPromo) {
            promoFrameDiscount = this.calculate2x1FrameDiscount(items, availableProducts);
            if (promoFrameDiscount > 0) {
                appliedPromos.push('2x1 Multifocal (Armazón Bonificado)');
            }
        }

        const subtotal = Math.max(0, rawSubtotal - promoFrameDiscount);
        const markupAmount = subtotal * (safePrice(markup) / 100);
        const subtotalWithMarkup = subtotal + markupAmount;
        const totalCash = subtotalWithMarkup * (1 - safePrice(discountCash) / 100);

        return {
            rawSubtotal,
            promoFrameDiscount,
            subtotal,
            subtotalWithMarkup: Math.round(subtotalWithMarkup),
            totalCash: Math.round(totalCash),
            appliedPromos
        };
    }

    /**
     * Calcula específicamente el descuento de armazón por la promo 2x1.
     */
    private static calculate2x1FrameDiscount(items: CartItem[], availableProducts: any[]): number {
        // Obtenemos todos los armazones en una lista plana
        const frameItems = items.flatMap(item => {
            if (!isFrame(item.product)) return [];
            return Array.from({ length: item.quantity || 1 }).map(() => item);
        });

        if (frameItems.length < 2) return 0;

        // Ordenamos por precio descendente para bonificar el segundo más caro (o según regla de negocio)
        // La regla actual de Atelier bonifica el segundo armazón.
        const sortedFrames = [...frameItems].sort((a, b) => safePrice(b.price) - safePrice(a.price));
        const targetFrame = sortedFrames[1]; // El segundo armazón

        if (!targetFrame) return 0;

        const framePrice = safePrice(targetFrame.price);

        // Si es Atelier, 100% bonificado
        if (isAtelierFrame(targetFrame.product)) {
            return framePrice;
        }

        // Si no es Atelier, se bonifica hasta el precio promedio de los Atelier
        const atelierFrames = availableProducts.filter(
            p => getCategoryKey(p.type, p.category) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0
        );

        if (atelierFrames.length > 0) {
            const avgAtelier = atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length;
            return Math.min(framePrice, Math.round(avgAtelier));
        }

        return 0;
    }
}
