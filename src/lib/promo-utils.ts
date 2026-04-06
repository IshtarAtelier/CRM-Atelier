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
