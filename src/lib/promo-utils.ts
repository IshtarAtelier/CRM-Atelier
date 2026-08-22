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
 * ¿A este producto se le puede tildar "entra en el 2x1"?
 *
 * Son los que se le ponen en la cara al cliente: armazones de receta y lentes
 * de sol. Solo define dónde aparece el tilde en Stock; que entre o no lo dice
 * `eligible2x1`.
 */
export const puedeEntrarEn2x1 = (p: any): boolean => {
    if (!p) return false;
    const t = normalizeText(`${p.type || ''} ${p.category || ''}`);
    return t.includes('armazon') || t.includes('marco') || t.includes('frame') || t.includes('sol');
};

/**
 * ¿Este armazón puede ser el bonificado de un 2x1?
 *
 * Se decide a mano, tildando el armazón en Stock (`eligible2x1`), NUNCA por la
 * marca. Antes se deducía: "Atelier" iba gratis y cualquier otro armazón se
 * bonificaba hasta el promedio de los Atelier, así que un armazón de la tienda
 * web de $160.000 se terminaba cobrando $35.143 sin que nadie lo decidiera.
 * Sin tilde, el armazón se cobra completo.
 */
export const isFrameEligible2x1 = (p: any): boolean => {
    if (!p) return false;
    return p.eligible2x1 === true;
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
 * Detects the dedicated "Teñido" treatment product (tinting: compacto,
 * degradé o según muestra — el estilo no cambia el producto, es metadata en
 * `crystalColorType` del OrderItem). El producto real en catálogo tiene
 * category: 'Tratamiento', type: 'Tratamientos' — NO 'ADDON' (a diferencia de
 * lo que asume `needsColorSelection` en crystal-color-utils.ts).
 */
export const isTeñidoAddon = (p: any): boolean => {
    if (!p) return false;
    // El add-on de teñido se reconoce por lo que ES, no por un nombre exacto.
    //
    // La versión anterior exigía categoría 'Tratamiento' y nombre exactamente
    // "Teñido". En el catálogo real los productos se llaman "Teñido Compacto",
    // "Teñido Degradé", "Teñido según muestra" y viven en categoría Cristal, así
    // que NINGUNO entraba: el teñido de un 2x1 de multifocales se cobraba $15.000
    // por ojo cuando tenía que ir bonificado.
    //
    // Se pide que el nombre EMPIECE con teñido: alcanza para las variantes y
    // deja afuera a los cristales que solo lo mencionan (un multifocal
    // fotocromático no es un add-on de teñido y se cobra).
    const nombre = normalizeText(p.name || '');
    return nombre === 'tenido' || nombre.startsWith('tenido ');
};

/**
 * Robust check if a product is a treatment (categoría 'Tratamiento').
 */
export const isTreatment = (p: any): boolean => {
    if (!p) return false;
    return p.category === 'Tratamiento';
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
    if (isTreatment(p)) return 'Tratamiento';

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
 * ── Regla canónica del 2x1 de multifocales ──────────────────────────────────
 * Los DOS lugares que mueven plata con esta promo (PricingService para totales
 * y recalculateCrystalPrices para los cristales) leen de acá. Si la regla
 * cambia, se toca este archivo y nada más.
 */

/**
 * ¿La venta tiene la promo 2x1 activa? La enciende un CRISTAL con el 2x1
 * tildado (o detectado por nombre, legacy), excluyendo Mi Primer Varilux.
 * Los armazones nunca la encienden: solo pueden ser el bonificado.
 */
export const hasActive2x1Promo = (items: any[]): boolean => {
    if (!Array.isArray(items)) return false;
    return items.some(
        it => it && isCrystal(it.product) && isMultifocal2x1(it.product) && !isMiPrimerVarilux(it.product)
    );
};

/**
 * Elige el armazón bonificado de un 2x1 y devuelve cuánto descontar.
 *
 * Regla completa (confirmada por Ishtar el 22/8/26):
 *  - Solo corre si `hasActive2x1Promo` (la valida acá adentro: ningún llamador
 *    puede saltearla por olvido).
 *  - Candidatos: armazones, y cualquier producto tildado a mano (`eligible2x1`)
 *    aunque su categoría no diga "armazón" (lentes de sol).
 *  - La cantidad expande: 2 unidades del mismo armazón son 2 candidatos.
 *  - DOS O MÁS tildados: el más caro de la venta se cobra siempre; el
 *    bonificado es el más caro de los siguientes que esté tildado, y va sin
 *    cargo ENTERO — sin topes ni promedios escondidos.
 *  - MEZCLA (un solo tildado + al menos otro armazón sin tildar): el tildado
 *    queda al 50%, sea el caro o el barato. Ni gratis ni entero: mitad.
 *  - Sin tildados, o un armazón solo: no se regala ni descuenta nada.
 *
 * Acepta ítems con `price` (ventas guardadas) o `customPrice` (cotizador).
 */
export const pick2x1FrameDiscount = (
    items: any[]
): { discount: number; itemName: string | null } => {
    const nada = { discount: 0, itemName: null };
    if (!hasActive2x1Promo(items)) return nada;

    const precioDe = (it: any) => safePrice(it.customPrice !== undefined ? it.customPrice : it.price);
    const nombreDe = (it: any) => `${it.product?.brand || ''} ${it.product?.name || 'Armazón'}`.trim();

    const candidatos = (items || []).flatMap(it => {
        if (!it || (!isFrame(it.product) && !isFrameEligible2x1(it.product))) return [];
        return Array.from({ length: it.quantity || 1 }).map(() => it);
    });
    if (candidatos.length < 2) return nada;

    const tildados = candidatos.filter(it => isFrameEligible2x1(it.product));

    // MEZCLA: un solo tildado acompañado de armazones sin promo → 50% off.
    if (tildados.length === 1) {
        const tildado = tildados[0];
        return { discount: Math.round(precioDe(tildado) / 2), itemName: `${nombreDe(tildado)} (50%)` };
    }

    // Dos o más tildados: el más caro de la venta se cobra, el mejor de los
    // siguientes tildados va gratis entero.
    const ordenados = [...candidatos].sort((a, b) => precioDe(b) - precioDe(a));
    const bonificado = ordenados.slice(1).find(it => isFrameEligible2x1(it.product));
    if (!bonificado) return nada;

    return { discount: precioDe(bonificado), itemName: nombreDe(bonificado) };
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

/**
 * Bonifica el tratamiento de Teñido (compacto, degradé o según muestra — son
 * estilos del mismo producto "Teñido") cuando la orden tiene la promo 2x1
 * multifocal activa Y el Teñido es el ÚNICO tratamiento agregado. Si hay
 * cualquier otro ítem de categoría 'Tratamiento' además del Teñido, no se
 * bonifica.
 *
 * Cuando NO es elegible para la bonificación, el precio se resuelve por
 * ESTILO (item.crystalColorType → COMPACTO/MUESTRA/DEGRADE) usando
 * `tintStylePrices` (cargado en Stock → Paleta de Colores). Si el estilo no
 * tiene precio cargado, o el ítem todavía no tiene estilo elegido, cae al
 * precio de lista del producto "Teñido".
 *
 * Mutates the items in-place (updating item.customPrice / item.price and item.isPromo).
 * Returns true if any prices or flags were modified, false otherwise.
 */
export function applyTeñidoPromoDiscount(items: any[], tintStylePrices?: Record<string, number>): boolean {
    if (!items || items.length === 0) return false;

    const teñidoItems = items.filter(i => isTeñidoAddon(i.product));
    if (teñidoItems.length === 0) return false;

    const hasMultifocalPromo = hasActive2x1Promo(items);
    // "Solo ese tratamiento": ningún OTRO tratamiento además del teñido.
    //
    // Antes se comparaban cantidades (`treatmentItems.length === teñidoItems.length`),
    // lo que daba falso apenas el teñido dejaba de ser categoría Tratamiento —
    // 0 tratamientos contra 2 teñidos no es igual, y la promo no se aplicaba.
    // Lo que importa es si hay otro tratamiento, no cuántos.
    const otrosTratamientos = items.filter(i => isTreatment(i.product) && !isTeñidoAddon(i.product));
    const isEligible = hasMultifocalPromo && otrosTratamientos.length === 0;

    let modified = false;
    for (const item of teñidoItems) {
        const stylePrice = item.crystalColorType ? tintStylePrices?.[item.crystalColorType] : undefined;
        const expectedPrice = isEligible ? 0 : (stylePrice ?? safePrice(item.product?.price));
        const currentPrice = item.customPrice !== undefined ? item.customPrice : item.price;
        if (currentPrice !== expectedPrice) {
            if (item.customPrice !== undefined) item.customPrice = expectedPrice;
            else item.price = expectedPrice;
            modified = true;
        }
        if (item.isPromo !== isEligible) {
            item.isPromo = isEligible;
            modified = true;
        }
    }

    return modified;
}
