// Centralized promotion logic for CRM-Atelier Cotizador

/**
 * Detects if a product is a multifocal/progresivo eligible for the 2x1 promotion.
 * Rules: Must contain (multifocal OR progresivo) AND (2x1).
 */
export const isMultifocal2x1 = (p: any): boolean => {
    if (!p) return false;

    // Primary: explicit flag set by admin — authoritative source of truth
    if (p.is2x1 === true) return true;

    // Fallback: legacy name-based detection (requires BOTH multifocal AND "2x1" in name)
    const name = (p.name || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const type = (p.type || '').toLowerCase();
    const model = (p.model || '').toLowerCase();
    
    const fullSearch = `${name} ${brand} ${type} ${model}`;
    
    const isMT = fullSearch.includes('multifocal') || fullSearch.includes('progresivo');
    const is2x1 = fullSearch.includes('2x1');
    
    return isMT && is2x1;
};

/**
 * Detects if a frame is from the Atelier brand or should be treated as such.
 */
export const isAtelierFrame = (p: any): boolean => {
    if (!p) return false;
    const brand = (p.brand || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const category = (p.category || '');
    
    return brand.includes('atelier') || name.includes('atelier') || category === 'ATELIER';
};

/**
 * Robust check if a product is a lens/crystal.
 */
export const isCrystal = (p: any): boolean => {
    if (!p) return false;
    const type = (p.type || '').toLowerCase();
    return p.category === 'LENS' || type.includes('cristal');
};

/**
 * Specific exclusion for 'Mi Primer Varilux' which might have different rules.
 */
export const isMiPrimerVarilux = (p: any): boolean => {
    if (!p) return false;
    return (p.name || '').toLowerCase().includes('mi primer varilux');
};

/**
 * Robust check if a product is a frame (armazón).
 */
export const isFrame = (p: any): boolean => {
    if (!p) return false;
    const type = (p.type || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return type.includes('armazón') || type.includes('armazon') || 
           category.includes('armazón') || category.includes('armazon') ||
           category === 'frame' || type === 'frame';
};

/**
 * Determines the general category key for consistent styling and logic.
 */
export function getCategoryKey(type: string | null): string {
    if (!type) return 'Otros';
    const t = type.toLowerCase();
    if (t.includes('armazón') || t.includes('armazon')) return 'Armazón';
    if (t.includes('cristal') || t.includes('monofocal') || t.includes('multifocal') || t.includes('bifocal') || t.includes('ocupacional') || t.includes('coquil') || t.includes('progresivo')) return 'Cristal';
    if (t.includes('lente de sol') || t.includes('sol')) return 'Lente de sol';
    if (t.includes('lente de contacto') || t.includes('contacto')) return 'Lente de contacto';
    if (t.includes('accesorio')) return 'Accesorio';
    if (t.includes('reloj')) return 'Reloj';
    if (t.includes('líquido') || t.includes('solución') || t.includes('liquido') || t.includes('solucion')) return 'Líquido / Solución';
    if (t.includes('joyería') || t.includes('joyeria')) return 'Joyería';
    return 'Otros';
}
/**
 * Safely parses a price value to a number.
 */
export const safePrice = (price: any): number => {
    if (price === null || price === undefined || isNaN(Number(price))) return 0;
    return Number(price);
};

/**
 * Calculates the promo frame discount for 2x1 multifocal promotions.
 * When a multifocal 2x1 crystal is in the cart, the second (cheapest) frame
 * gets a discount: if it's Atelier, it's fully free; otherwise, discounted
 * up to the Atelier average price.
 * 
 * @param items - Array of cart items with { product, quantity, customPrice, uid }
 * @param availableProducts - Optional full product list to calculate Atelier average price
 * @returns The frame discount amount to subtract from the subtotal
 */
export const calculatePromoFrameDiscount = (
    items: any[],
    availableProducts?: any[]
): number => {
    // Check if there's a multifocal 2x1 promo active (crystal that is 2x1 and NOT Mi Primer Varilux)
    const hasMultifocalPromo = items.some(
        it => isCrystal(it.product) && isMultifocal2x1(it.product) && !isMiPrimerVarilux(it.product)
    );
    if (!hasMultifocalPromo) return 0;

    // Flatten frames by quantity to find the second cheapest frame
    const flattenedFrames = items.flatMap(i => {
        if (getCategoryKey(i.product.type) !== 'Armazón') return [];
        return Array.from({ length: i.quantity || 1 }).map((_, idx) => ({
            ...i,
            virtualIdx: idx
        }));
    });

    if (flattenedFrames.length < 2) return 0;

    // Sort by price descending — the second one is the promo target
    const sortedFrames = [...flattenedFrames].sort((a, b) => safePrice(b.customPrice) - safePrice(a.customPrice));
    const secondFrame = sortedFrames[1];
    if (!secondFrame) return 0;

    const framePrice = safePrice(secondFrame.customPrice);

    // If it's an Atelier frame, it's fully free
    if (isAtelierFrame(secondFrame.product)) return framePrice;

    // Otherwise, discount up to the Atelier average price
    let atelierAvgPrice = 0;
    if (availableProducts && availableProducts.length > 0) {
        const atelierFrames = availableProducts.filter(
            p => getCategoryKey(p.type) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0
        );
        if (atelierFrames.length > 0) {
            atelierAvgPrice = Math.round(
                atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length
            );
        }
    }

    return Math.min(framePrice, safePrice(atelierAvgPrice));
};

/**
 * Calculates the complete quote totals including promo frame discount.
 * This is the single source of truth for subtotal/total calculations.
 * 
 * @param items - Array of cart items with { product, quantity, customPrice }
 * @param markup - Markup percentage (e.g. 10 for 10%)
 * @param discountCash - Cash discount percentage
 * @param availableProducts - Optional full product list for Atelier avg price calculation
 * @returns { subtotal, subtotalWithMarkup, totalCash }
 */
export const calculateQuoteTotals = (
    items: any[],
    markup: number,
    discountCash: number,
    availableProducts?: any[]
): { rawSubtotal: number; promoFrameDiscount: number; subtotal: number; subtotalWithMarkup: number; totalCash: number } => {
    const rawSubtotal = items.reduce((s, i) => s + (safePrice(i.customPrice) * (i.quantity || 1)), 0);
    const promoDiscount = calculatePromoFrameDiscount(items, availableProducts);
    const subtotal = Math.max(0, rawSubtotal - promoDiscount);
    const markupAmount = subtotal * (safePrice(markup) / 100);
    const subtotalWithMarkup = subtotal + markupAmount;
    const totalCash = subtotalWithMarkup * (1 - safePrice(discountCash) / 100);

    return {
        rawSubtotal,
        promoFrameDiscount: promoDiscount,
        subtotal,
        subtotalWithMarkup: Math.round(subtotalWithMarkup),
        totalCash: Math.round(totalCash),
    };
};
