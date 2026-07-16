/**
 * Heurísticas sobre pedidos de laboratorio, tolerantes a productos borrados
 * (usan los snapshots de OrderItem como fallback del producto vivo).
 */

interface ItemLike {
    product?: {
        category?: string | null;
        type?: string | null;
        name?: string | null;
        model?: string | null;
        brand?: string | null;
        origin?: string | null;
        laboratory?: string | null;
    } | null;
    productCategorySnapshot?: string | null;
    productTypeSnapshot?: string | null;
    productNameSnapshot?: string | null;
    productBrandSnapshot?: string | null;
    laboratorySnapshot?: string | null;
}

/** Un pedido va al laboratorio (y lleva nº de operación) si tiene un cristal.
 *  Mismo criterio que calculateEstimatedDays: categoría/tipo "Cristal". */
export function needsLabOperation(items: ItemLike[]): boolean {
    return (items || []).some(it => {
        const cat = (it.product?.category || it.productCategorySnapshot || '').toLowerCase();
        const type = (it.product?.type || it.productTypeSnapshot || '').toLowerCase();
        return cat.includes('cristal') || type.includes('cristal');
    });
}

/** Nombre del laboratorio del pedido (OPTOVISION / GRUPO OPTICO / LA CAMARA),
 *  tomado del primer cristal que lo tenga registrado. */
export function labNameFor(items: ItemLike[]): string | null {
    for (const it of items || []) {
        const lab = (it.laboratorySnapshot || it.product?.laboratory || '').trim();
        if (lab) return lab;
    }
    return null;
}

/** Adapta los items para calculateEstimatedDays: si el producto fue borrado,
 *  arma un pseudo-producto desde los snapshots (si no, contaría como stock de 5 días). */
export function itemsForEstimation(items: ItemLike[]): { product: any }[] {
    return (items || []).map(it => ({
        product: it.product || {
            category: it.productCategorySnapshot,
            type: it.productTypeSnapshot,
            name: it.productNameSnapshot,
            brand: it.productBrandSnapshot,
            model: '',
            origin: null,
        },
    }));
}
