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
    promoFrameName: string | null; // Added to identify the discounted item
    subtotal: number;
    subtotalWithMarkup: number;
    totalCash: number;
    appliedPromos: string[];
    specialDiscountAmount: number;
}

export interface OrderFinancials {
    listPrice: number;
    totalCash: number;
    totalTransfer: number;
    totalCard: number;
    /** Cuota sin interés a 3 meses = totalCard / 3 */
    installment3: number;
    /** Cuota sin interés a 6 meses = totalCard / 6 */
    installment6: number;
    paidReal: number;
    listEquivalentPaid: number;
    remainingList: number;
    remainingCash: number;
    remainingTransfer: number;
    remainingCard: number;
    hasBalance: boolean;
    progress: number;
    discountCash: number;
    discountTransfer: number;
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
        availableProducts: any[] = [],
        specialDiscount: number = 0
    ): PricingResult {
        const rawSubtotal = items.reduce((sum, item) => sum + (safePrice(item.price) * (item.quantity || 1)), 0);
        
        let promoFrameDiscount = 0;
        let promoFrameName: string | null = null;
        const appliedPromos: string[] = [];

        // Lógica de 2x1 en multifocales (regla actual)
        const hasMultifocalPromo = items.some(
            it => isCrystal(it.product) && isMultifocal2x1(it.product)
        );

        if (hasMultifocalPromo) {
            const promo = this.calculate2x1FrameDiscount(items, availableProducts);
            promoFrameDiscount = promo.discount;
            promoFrameName = promo.itemName;
            
            if (promoFrameDiscount > 0) {
                appliedPromos.push('2x1 Multifocal (Armazón Bonificado)');
            }
        }

        const subtotal = Math.max(0, rawSubtotal - promoFrameDiscount);
        const markupAmount = subtotal * (safePrice(markup) / 100);
        let subtotalWithMarkup = subtotal + markupAmount;
        
        // Aplicar el descuento especial como valor exacto
        const validSpecialDiscount = Math.min(subtotalWithMarkup, safePrice(specialDiscount));
        subtotalWithMarkup = subtotalWithMarkup - validSpecialDiscount;

        const totalCash = subtotalWithMarkup * (1 - safePrice(discountCash) / 100);

        return {
            rawSubtotal,
            promoFrameDiscount,
            promoFrameName,
            subtotal,
            subtotalWithMarkup: Math.round(subtotalWithMarkup),
            totalCash: Math.round(totalCash),
            appliedPromos,
            specialDiscountAmount: validSpecialDiscount
        };
    }

    /**
     * Calcula el desglose financiero completo (Totales y Saldos) para una orden existente.
     */
    static calculateOrderFinancials(order: any): OrderFinancials {
        const discCash = order.discountCash ?? 20;
        const discTrans = order.discountTransfer ?? 15;
        const listPrice = order.subtotalWithMarkup || 0;

        // Totales base
        const totalCash = Math.round(listPrice * (1 - discCash / 100));
        const totalTransfer = Math.round(listPrice * (1 - discTrans / 100));
        const totalCard = listPrice;

        // Cálculo de "Equivalente de Lista" pagado
        const listEquivalentPaid = (order.payments || []).reduce((acc: number, p: any) => {
            const amount = p.amount || 0;
            const method = (p.method || '').toUpperCase().trim();
            
            // Evitar división por cero
            const factorCash = 1 - (discCash / 100);
            const factorTrans = 1 - (discTrans / 100);

            // Coincidencias robustas para métodos de pago
            const isCash = ['CASH', 'EFECTIVO', 'EFVO'].includes(method);
            const isTrans = ['TRANSFER', 'TRANSFERENCIA', 'TRANSF', 'DEPOSITO'].some(m => method.includes(m));

            if (isCash && factorCash > 0)
                return acc + (amount / factorCash);
            if (isTrans && factorTrans > 0)
                return acc + (amount / factorTrans);
            
            // Si es tarjeta o desconocido, se toma valor nominal (Lista)
            return acc + amount;
        }, 0);

        const paidRealFromPayments = (order.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
        
        // Failsafe: Si no hay desgloses de pagos pero el campo 'paid' tiene valor, usamos ese
        const paidReal = Math.max(paidRealFromPayments, order.paid || 0);
        
        // Si usamos el failsafe de 'paid', ajustamos el listEquivalentPaid si este era 0
        const finalListEquivalentPaid = (listEquivalentPaid === 0 && paidReal > 0) ? paidReal : listEquivalentPaid;

        const remainingList = Math.max(0, listPrice - finalListEquivalentPaid);
        const hasBalance = remainingList > 1000; // Tolerancia de 1000 pesos solicitada por el usuario
        
        const progress = listPrice > 0 ? (finalListEquivalentPaid / listPrice) * 100 : 0;

        return {
            listPrice,
            totalCash,
            totalTransfer,
            totalCard,
            installment3: Math.round(totalCard / 3),
            installment6: Math.round(totalCard / 6),
            paidReal,
            listEquivalentPaid: Math.round(listEquivalentPaid * 100) / 100,
            remainingList: Math.round(remainingList),
            remainingCash: Math.round(remainingList * (1 - discCash / 100)),
            remainingTransfer: Math.round(remainingList * (1 - discTrans / 100)),
            remainingCard: Math.round(remainingList),
            hasBalance,
            progress,
            discountCash: discCash,
            discountTransfer: discTrans
        };
    }

    /**
     * Calcula específicamente el descuento de armazón por la promo 2x1.
     */
    private static calculate2x1FrameDiscount(items: CartItem[], availableProducts: any[]): { discount: number; itemName: string | null } {
        // Obtenemos todos los armazones en una lista plana
        const frameItems = items.flatMap(item => {
            if (!isFrame(item.product)) return [];
            return Array.from({ length: item.quantity || 1 }).map(() => item);
        });

        if (frameItems.length < 2) return { discount: 0, itemName: null };

        // Ordenamos por precio descendente para bonificar el segundo más caro
        const sortedFrames = [...frameItems].sort((a, b) => safePrice(b.price) - safePrice(a.price));
        const targetFrame = sortedFrames[1]; // El segundo armazón

        if (!targetFrame) return { discount: 0, itemName: null };

        const framePrice = safePrice(targetFrame.price);
        const frameName = `${targetFrame.product?.brand || ''} ${targetFrame.product?.name || 'Armazón'}`.trim();

        // Si es Atelier, 100% bonificado
        if (isAtelierFrame(targetFrame.product)) {
            return { discount: framePrice, itemName: frameName };
        }

        // Si no es Atelier, se bonifica hasta el precio promedio de los Atelier
        const atelierFrames = availableProducts.filter(
            p => getCategoryKey(p.type, p.category) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0
        );

        if (atelierFrames.length > 0) {
            const avgAtelier = atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length;
            const discountAmount = Math.min(framePrice, Math.round(avgAtelier));
            return { discount: discountAmount, itemName: frameName };
        }

        return { discount: 0, itemName: null };
    }
}
