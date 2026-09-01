import { hasActive2x1Promo, pick2x1FrameDiscount, safePrice } from '@/lib/promo-utils';
import { FACTOR_MP_CUOTAS_LARGAS } from '@/lib/constants/descuentos';
import { esMpCuotasLargas } from '@/lib/payment-card';

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
    /** Total financiado MP 12 cuotas = totalCard × 1,10 — el recargo va ADENTRO del importe; la leyenda del % no se muestra (ver promo-cuotas.ts) */
    totalCardFinanced: number;
    /** Cuota MP a 12 meses = totalCardFinanced / 12 */
    installment12: number;
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
    /**
     * Descuento especial en pesos que el admin ya aplicó a esta orden (0 si no hubo).
     * OJO: `listPrice` YA lo tiene restado — `subtotalWithMarkup` se guarda neto.
     * Para mostrar el renglón sin mentir hace falta el par: se parte de
     * `listPriceBeforeSpecial`, se resta `specialDiscount` y se llega a `listPrice`.
     */
    specialDiscount: number;
    /** Precio de lista ANTES del descuento especial (= listPrice + specialDiscount). */
    listPriceBeforeSpecial: number;
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
     * @param availableProducts - Sin uso desde que el 2x1 se tilda a mano por armazón.
     *   Se mantiene en la firma porque lo pasan todos los llamadores (cotizador, ficha,
     *   API de ventas); sacarlo es tocar seis archivos para nada.
     */
    static calculateTotals(
        items: CartItem[],
        markup: number = 0,
        discountCash: number = 0,
        _availableProducts: any[] = [],
        specialDiscount: number = 0
    ): PricingResult {
        const rawSubtotal = items.reduce((sum, item) => sum + (safePrice(item.price) * (item.quantity || 1)), 0);
        
        let promoFrameDiscount = 0;
        let promoFrameName: string | null = null;
        const appliedPromos: string[] = [];

        // 2x1 en multifocales: la regla completa (quién la enciende, quién puede
        // ser el bonificado y cuánto se descuenta) vive en promo-utils.ts.
        if (hasActive2x1Promo(items)) {
            const promo = pick2x1FrameDiscount(items);
            promoFrameDiscount = promo.discount;
            promoFrameName = promo.itemName;

            if (promoFrameDiscount > 0) {
                appliedPromos.push('2x1 Multifocal (Armazón Bonificado)');
            }
        }

        const subtotal = Math.max(0, rawSubtotal - promoFrameDiscount);
        const markupAmount = subtotal * (safePrice(markup) / 100);
        let subtotalWithMarkup = subtotal + markupAmount;
        
        // Aplicar el descuento especial como valor exacto.
        // El piso en 0 es defensivo: un descuento negativo (STAFF malicioso o
        // typo) INFLARÍA la venta en vez de descontarla. Se topea entre 0 y el
        // subtotal, así ningún llamador puede pasar un valor fuera de rango.
        const validSpecialDiscount = Math.min(subtotalWithMarkup, Math.max(0, safePrice(specialDiscount)));
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
     * Calculates the total estimated cost of an order by summing the cost of all its items.
     * This is used to audit laboratory invoices.
     */
    static calculateEstimatedCost(order: any): number {
        if (!order.items || order.items.length === 0) return 0;
        
        return order.items.reduce((total: number, item: any) => {
            // El snapshot congela el costo al momento de la venta; el costo vivo
            // del producto puede haber cambiado desde entonces (falsas alarmas).
            const productCost = item.productCostSnapshot ?? item.product?.cost ?? 0;
            // Los cristales se cargan con costo POR PAR pero la venta los guarda
            // como dos ítems (eye OD/OI) con el snapshot del par cada uno: cada
            // ojo cuenta la mitad para no duplicar el par.
            const perEyeHalf = item.eye ? 0.5 : 1;
            return total + (productCost * perEyeHalf * (item.quantity || 1));
        }, 0);
    }

    /**
     * Convierte una lista de pagos a su "equivalente de lista": cuánto precio de
     * lista cancela cada peso cobrado según su forma de pago. ÚNICO lugar de esa
     * conversión (regla de CLAUDE.md: el saldo nunca es lista − cobrado).
     * El espejo SQL vive en el filtro "con saldo" de src/app/api/orders/route.ts.
     */
    static listEquivalentOfPayments(
        payments: Array<{ method?: string | null; amount?: number | null }>,
        discountCash: number,
        discountTransfer: number
    ): number {
        const factorCash = 1 - (discountCash / 100);
        const factorTrans = 1 - (discountTransfer / 100);
        return (payments || []).reduce((acc: number, p) => {
            const amount = p.amount || 0;
            const method = (p.method || '').toUpperCase().trim();

            const isCash = ['CASH', 'EFECTIVO', 'EFVO'].includes(method);
            const isTrans = ['TRANSFER', 'TRANSFERENCIA', 'TRANSF', 'DEPOSITO'].some(m => method.includes(m));

            if (isCash && factorCash > 0) return acc + (amount / factorCash);
            if (isTrans && factorTrans > 0) return acc + (amount / factorTrans);
            // MP 12/18: el cliente paga lista × factor (costo financiero fijo);
            // cada peso cobrado vale 1/factor de lista. Sin esta rama, un cobro
            // completo en 12/18 dejaría la venta con sobrepago fantasma.
            if (esMpCuotasLargas(method)) return acc + (amount / FACTOR_MP_CUOTAS_LARGAS);

            // Tarjeta o desconocido: valor nominal (lista)
            return acc + amount;
        }, 0);
    }

    /**
     * Cuotas largas de Mercado Pago sobre un precio de lista. Único lugar del
     * cálculo: cotizador, PDFs y mensajes leen de acá (o de calculateOrderFinancials).
     */
    static cuotasMpLargas(listPrice: number) {
        const totalFinanced = Math.round(listPrice * FACTOR_MP_CUOTAS_LARGAS);
        return {
            totalFinanced,
            installment12: Math.round(totalFinanced / 12),
        };
    }

    /**
     * Números que ve el COMPRADOR en la tienda para un precio dado, todos
     * resueltos (regla de Ishtar: "el cliente no calcula nada"). Único lugar:
     * grillas, carrito, resumen del checkout, emails y CTAs leen de acá.
     * `cashDiscountPct` es el % de la promo web (setting web_promo_cash_discount).
     */
    static preciosVidriera(price: number, cashDiscountPct: number = 15) {
        const lista = Math.round(price || 0);
        const cuotasMp = PricingService.cuotasMpLargas(lista);
        return {
            lista,
            cuota6: Math.round(lista / 6),
            contado: Math.round(lista * (1 - cashDiscountPct / 100)),
            ahorroContado: Math.round(lista * (cashDiscountPct / 100)),
            cuota12: cuotasMp.installment12,
            total12: cuotasMp.totalFinanced,
        };
    }

    /**
     * Calcula el desglose financiero completo (Totales y Saldos) para una orden existente.
     */
    static calculateOrderFinancials(order: any): OrderFinancials {
        const discCash = order.discountCash ?? 20;
        const discTrans = order.discountTransfer ?? 15;
        // Las ventas web se crean sin subtotalWithMarkup (no pasan por el markup del
        // cotizador); sin este fallback, listPrice caía a 0 y toda venta web figuraba
        // "PAGADO" con saldo 0 sin importar cuánto se pagó en realidad.
        const listPrice = order.subtotalWithMarkup || order.total || 0;
        // El descuento especial no se recalcula acá: ya está restado dentro de
        // `subtotalWithMarkup`. Se expone para que las pantallas puedan mostrar el
        // renglón — sin esto, una venta con descuento se veía como un total más
        // barato sin ninguna explicación de por qué.
        const especial = Math.max(0, order.specialDiscount || 0);

        // Totales base
        const totalCash = Math.round(listPrice * (1 - discCash / 100));
        const totalTransfer = Math.round(listPrice * (1 - discTrans / 100));
        const totalCard = listPrice;
        const cuotasMp = PricingService.cuotasMpLargas(totalCard);

        // Cálculo de "Equivalente de Lista" pagado
        const listEquivalentPaid = PricingService.listEquivalentOfPayments(
            order.payments || [], discCash, discTrans
        );

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
            totalCardFinanced: cuotasMp.totalFinanced,
            installment12: cuotasMp.installment12,
            paidReal,
            listEquivalentPaid: Math.round(listEquivalentPaid * 100) / 100,
            remainingList: Math.round(remainingList),
            remainingCash: Math.round(remainingList * (1 - discCash / 100)),
            remainingTransfer: Math.round(remainingList * (1 - discTrans / 100)),
            remainingCard: Math.round(remainingList),
            hasBalance,
            progress,
            discountCash: discCash,
            discountTransfer: discTrans,
            specialDiscount: especial,
            listPriceBeforeSpecial: listPrice + especial
        };
    }

}

export const calculateQuoteTotals = (
    items: any[],
    markup: number,
    discountCash: number,
    availableProducts?: any[],
    specialDiscount: number = 0
): { 
    rawSubtotal: number; 
    promoFrameDiscount: number; 
    subtotal: number; 
    subtotalWithMarkup: number; 
    totalCash: number;
    appliedPromoName: string | null;
    specialDiscountAmount: number;
} => {
    const cartItems: CartItem[] = items.map(i => ({
        productId: i.productId || null,
        product: i.product,
        quantity: i.quantity,
        // `??` y no `||`: un customPrice de $0 (línea bonificada o pisada a mano)
        // es un precio válido, no una ausencia — con `||` caía al precio de lista
        // y el total no coincidía con lo que mostraban los renglones.
        price: i.customPrice ?? i.price
    }));

    const result = PricingService.calculateTotals(cartItems, markup, discountCash, availableProducts || [], specialDiscount);

    return {
        rawSubtotal: result.rawSubtotal,
        promoFrameDiscount: result.promoFrameDiscount,
        subtotal: result.subtotal,
        subtotalWithMarkup: result.subtotalWithMarkup,
        totalCash: result.totalCash,
        appliedPromoName: result.promoFrameName || (result.appliedPromos.length > 0 ? result.appliedPromos[0] : null),
        specialDiscountAmount: result.specialDiscountAmount
    };
};

