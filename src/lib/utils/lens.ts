// Reglas de cristales para reproceso / post-venta.
// Determina si el lente del pedido requiere cargar las medidas del armazón (A, B, ED, Puente).
//
// Regla (según negocio):
//  - Multifocal / Bifocal / Ocupacional / Coquil → SIEMPRE requieren medidas.
//  - Monofocal (u otro cristal) → solo si es de LABORATORIO (no de stock).
//  - Monofocal de stock → no requiere medidas de armazón.

const LENS_TYPE_KEYWORDS = ['MONOFOCAL', 'MULTIFOCAL', 'BIFOCAL', 'OCUPACIONAL', 'COQUIL'];
const ALWAYS_MEASURE_KEYWORDS = ['MULTIFOCAL', 'BIFOCAL', 'OCUPACIONAL', 'COQUIL'];

function isLensItem(it: any): boolean {
    const cat = (it?.product?.category || it?.productCategorySnapshot || '').toUpperCase();
    const type = (it?.product?.type || '').toUpperCase();
    return cat.includes('CRISTAL') || cat === 'LENS' || LENS_TYPE_KEYWORDS.some(t => type.includes(t));
}

function lensRequiresMeasures(it: any): boolean {
    const type = (it?.product?.type || '').toUpperCase();
    const origin = (it?.product?.origin || '').toUpperCase();
    const isStock = origin === 'STOCK';
    // Multifocal y familia: siempre
    if (ALWAYS_MEASURE_KEYWORDS.some(t => type.includes(t))) return true;
    // Monofocal / otro cristal: solo si es de laboratorio (origin distinto de STOCK; null se trata como lab)
    return !isStock;
}

/** ¿Algún lente del pedido requiere cargar las medidas del armazón para reprocesar? */
export function requiresFrameMeasurements(order: any): boolean {
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    const lenses = items.filter(isLensItem);
    return lenses.some(lensRequiresMeasures);
}

/** Trae las medidas del armazón (A, B, ED, Puente) del pedido para el par indicado. */
export function frameMeasuresForPair(order: any, pair: 1 | 2) {
    if (pair === 2) {
        return {
            frameA: order?.frameA2 != null ? String(order.frameA2) : '',
            frameB: order?.frameB2 != null ? String(order.frameB2) : '',
            frameEd: order?.frameEdc2 != null ? String(order.frameEdc2) : '',
            framePte: order?.frameDbl2 != null ? String(order.frameDbl2) : '',
        };
    }
    return {
        frameA: order?.frameA != null ? String(order.frameA) : '',
        frameB: order?.frameB != null ? String(order.frameB) : '',
        frameEd: order?.frameEdc != null ? String(order.frameEdc) : '',
        framePte: order?.frameDbl != null ? String(order.frameDbl) : '',
    };
}

/** ¿El par tiene las 4 medidas del armazón completas? */
export function hasFrameMeasures(pairRx: any): boolean {
    return !!(pairRx?.frameA && pairRx?.frameB && pairRx?.frameEd && pairRx?.framePte);
}
