import { addBusinessDays } from './business-days';

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

/**
 * Motivo por el que el saldo de un pedido ya es reclamable.
 *   · 'sin-lab'   → no lleva cristal: corre desde la venta.
 *   · 'fabricado' → el laboratorio lo dio por terminado (FINISHED/READY/DELIVERED).
 *   · 'vencido'   → no está finalizado, pero ya pasó el plazo del cristal.
 *   · null        → todavía en fabricación y en plazo: no se reclama.
 */
export type BalanceDueKind = 'sin-lab' | 'fabricado' | 'vencido';

/**
 * ¿El saldo de este pedido ya es reclamable, y por qué?
 *
 * Un pedido de laboratorio no debería figurar como saldo pendiente mientras el
 * cristal todavía se está haciendo y está en plazo: el cliente paga contra
 * entrega y aparecer antes genera reclamos por algo que aún no está.
 *
 * Pasado el plazo sí aparece, esté finalizado o no — que el lab se haya
 * atrasado no es motivo para perderle el rastro al saldo.
 */
export function balanceDueKind(
    order: { labStatus?: string | null; labSentAt?: Date | string | null; items?: ItemLike[] },
    estimatedDays: number,
    now: Date = new Date()
): BalanceDueKind | null {
    const items = order.items || [];
    if (!needsLabOperation(items)) return 'sin-lab';

    const status = order.labStatus || 'NONE';
    if (status === 'FINISHED' || status === 'READY' || status === 'DELIVERED') return 'fabricado';

    // Sin fecha de envío no hay plazo que haya vencido.
    if (!order.labSentAt) return null;
    return now >= addBusinessDays(new Date(order.labSentAt), estimatedDays) ? 'vencido' : null;
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
