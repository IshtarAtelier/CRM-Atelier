// Centralized promotion logic for CRM-Atelier Cotizador

/**
 * Detects if a product is a multifocal/progresivo eligible for the 2x1 promotion.
 * Rules: Must contain (multifocal OR progresivo) AND (2x1).
 */
/**
 * Helper to normalize strings for robust keyword matching (removes accents and special chars).
 */
const normalizeText = (text: string): string => {
    return (text || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s]/g, " ")   // Replace special chars with spaces
        .trim();
};

export const isMultifocal2x1 = (p: any): boolean => {
    if (!p) return false;

    // Primary: explicit flag set by admin — authoritative source of truth
    if (p.is2x1 === true) return true;

    // Fallback: legacy name-based detection
    const fullSearch = normalizeText(`${p.name || ''} ${p.brand || ''} ${p.type || ''} ${p.model || ''}`);
    
    const isMT = fullSearch.includes('multifocal') || fullSearch.includes('progresivo');
    
    // Robust 2x1 detection using Regex
    // Matches: 2x1, 2 x 1, 2por1, 2 por 1, dos por uno, dosxuno
    const promoRegex = /\b(2\s?x\s?1|2\s?por\s?1|dos\s?por\s?uno|dos\s?x\s?uno)\b/i;
    const is2x1 = promoRegex.test(fullSearch);
    
    return isMT && is2x1;
};

/**
 * Detects if a frame is from the Atelier brand or should be treated as such.
 */
export const isAtelierFrame = (p: any): boolean => {
    if (!p) return false;
    const brand = (p.brand || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    
    return brand.includes('atelier') || name.includes('atelier') || category === 'atelier' || category === 'atelier de receta';
};

/**
 * Robust check if a product is a lens/crystal.
 */
export const isCrystal = (p: any): boolean => {
    if (!p) return false;
    const type = (p.type || '').toLowerCase();
    return p.category === 'Cristal' || type.includes('cristal');
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
    // Robust normalization for keyword matching
    const t = normalizeText(`${p.type || ''} ${p.category || ''}`);
    const brand = normalizeText(p.brand || '');
    
    return t.includes('armazon') || t.includes('marco') || t.includes('frame') || 
           brand.includes('atelier') || t.includes('atelier');
};

/**
 * Determines the general category key for consistent styling and logic.
 */
/**
 * Determines the general category key for consistent styling and logic.
 * Improved to check both Category (Prisma) and Type (Subcategory).
 */
export function getCategoryKey(type: string | null, category?: string | null): string {
    const p = { type, category };
    
    if (isFrame(p)) return 'Armazón';
    if (isCrystal(p)) return 'Cristal';

    // Fallbacks for other specific types
    const t = normalizeText(type || '');
    if (t.includes('sol')) return 'Lente de sol';
    if (t.includes('contacto')) return 'Lente de contacto';
    if (t.includes('accesorio')) return 'Accesorio';
    if (t.includes('reloj')) return 'Reloj';
    if (t.includes('líquido') || t.includes('solución') || t.includes('liquido')) return 'Líquido / Solución';
    if (t.includes('joyeria')) return 'Joyería';
    
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
        if (!isFrame(i.product)) return [];
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
            p => getCategoryKey(p.type, p.category) === 'Armazón' && isAtelierFrame(p) && safePrice(p.price) > 0
        );
        if (atelierFrames.length > 0) {
            atelierAvgPrice = Math.round(
                atelierFrames.reduce((s, f) => s + safePrice(f.price), 0) / atelierFrames.length
            );
        } else {
            atelierAvgPrice = 0; // Guard against division by zero
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
import { PricingService, CartItem } from '@/services/PricingService';

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
        price: i.customPrice || i.price
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

/**
 * Recalculates the prices of crystal items based on 2x1 promo rules.
 * Mutates the items in-place (updating item.customPrice / item.price and item.isPromo).
 * Returns true if any prices or flags were modified, false otherwise.
 */
export function recalculateCrystalPrices(items: any[]): boolean {
    if (!items || items.length === 0) return false;
    let modified = false;

    // 1. Gather all crystal items
    const crystalItems = items.filter(i => isCrystal(i.product));

    // For any crystal that is NOT a 2x1 multifocal, its price should be sprice / 2
    const regularCrystals = crystalItems.filter(i => !isMultifocal2x1(i.product) || isMiPrimerVarilux(i.product));
    for (const item of regularCrystals) {
        const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
        const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
        if (currentPrice !== expectedPrice) {
            if (item.customPrice !== undefined) item.customPrice = expectedPrice;
            else item.price = expectedPrice;
            modified = true;
        }
        if (item.isPromo !== false) {
            item.isPromo = false;
            modified = true;
        }
    }

    // 2. Process 2x1 Multifocal crystals
    const promoCrystals = crystalItems.filter(i => isMultifocal2x1(i.product) && !isMiPrimerVarilux(i.product));

    // To resolve the Product-ID Coupling Bug, we pair up ALL 2x1 multifocal crystals together.
    // Group them by product ID first to make pairs of the same model.
    const groupedByProduct: Record<string, { od: any[], oi: any[] }> = {};
    for (const item of promoCrystals) {
        const pId = item.product?.id || 'unknown';
        if (!groupedByProduct[pId]) {
            groupedByProduct[pId] = { od: [], oi: [] };
        }
        if (item.eye === 'OD') {
            groupedByProduct[pId].od.push(item);
        } else if (item.eye === 'OI') {
            groupedByProduct[pId].oi.push(item);
        } else {
            // Unspecified eye? Treat as standard price
            const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
            const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
            if (currentPrice !== expectedPrice) {
                if (item.customPrice !== undefined) item.customPrice = expectedPrice;
                else item.price = expectedPrice;
                modified = true;
            }
            if (item.isPromo !== false) {
                item.isPromo = false;
                modified = true;
            }
        }
    }

    // Form pairs
    interface CrystalPair {
        productId: string;
        price: number;
        od: any;
        oi: any;
    }
    const pairs: CrystalPair[] = [];
    const unmatched: any[] = [];

    for (const [pId, lists] of Object.entries(groupedByProduct)) {
        const minLen = Math.min(lists.od.length, lists.oi.length);
        for (let idx = 0; idx < minLen; idx++) {
            const od = lists.od[idx];
            const oi = lists.oi[idx];
            pairs.push({
                productId: pId,
                price: safePrice(od.product?.price),
                od,
                oi
            });
        }
        // Add unmatched to unmatched list
        if (lists.od.length > minLen) {
            unmatched.push(...lists.od.slice(minLen));
        }
        if (lists.oi.length > minLen) {
            unmatched.push(...lists.oi.slice(minLen));
        }
    }

    // Sort pairs by price descending so the CHEAPEST pairs are free!
    pairs.sort((a, b) => b.price - a.price);

    // Apply 2x1 pricing:
    // First pair (index 0) -> paid (each eye gets Math.round(price / 2))
    // Second pair (index 1) -> free (each eye gets 0, isPromo = true)
    // Third pair (index 2) -> paid
    // Fourth pair (index 3) -> free
    // etc.
    pairs.forEach((pair, pairIdx) => {
        const isFree = pairIdx % 2 !== 0;
        const expectedPrice = isFree ? 0 : Math.round(pair.price / 2);

        // Update OD
        const odPrice = pair.od.customPrice !== undefined ? pair.od.customPrice : pair.od.price;
        if (odPrice !== expectedPrice) {
            if (pair.od.customPrice !== undefined) pair.od.customPrice = expectedPrice;
            else pair.od.price = expectedPrice;
            modified = true;
        }
        if (pair.od.isPromo !== isFree) {
            pair.od.isPromo = isFree;
            modified = true;
        }

        // Update OI
        const oiPrice = pair.oi.customPrice !== undefined ? pair.oi.customPrice : pair.oi.price;
        if (oiPrice !== expectedPrice) {
            if (pair.oi.customPrice !== undefined) pair.oi.customPrice = expectedPrice;
            else pair.oi.price = expectedPrice;
            modified = true;
        }
        if (pair.oi.isPromo !== isFree) {
            pair.oi.isPromo = isFree;
            modified = true;
        }
    });

    // Unmatched eyes are charged full price (sprice / 2) and are not promo
    unmatched.forEach(item => {
        const expectedPrice = Math.round(safePrice(item.product?.price) / 2);
        const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
        if (currentPrice !== expectedPrice) {
            if (item.customPrice !== undefined) item.customPrice = expectedPrice;
            else item.price = expectedPrice;
            modified = true;
        }
        if (item.isPromo !== false) {
            item.isPromo = false;
            modified = true;
        }
    });

    return modified;
}
