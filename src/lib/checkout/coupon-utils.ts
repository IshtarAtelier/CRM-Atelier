// Reglas de validación y cálculo de cupones de descuento del checkout web.
// Usadas tanto por el endpoint público de validación como por el cobro (payway),
// para que el front nunca pueda "inventar" un descuento.

export interface CouponLike {
    code: string;
    type: string; // PERCENT | FIXED
    value: number;
    active: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    usedCount: number;
    minTotal: number | null;
}

export function validateCoupon(coupon: CouponLike | null, cartTotal: number): { ok: boolean; reason?: string } {
    if (!coupon) return { ok: false, reason: 'El cupón no existe.' };
    if (!coupon.active) return { ok: false, reason: 'El cupón ya no está disponible.' };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return { ok: false, reason: 'El cupón está vencido.' };
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        return { ok: false, reason: 'El cupón alcanzó su límite de usos.' };
    }
    if (coupon.minTotal != null && cartTotal < coupon.minTotal) {
        return { ok: false, reason: `El cupón es válido para compras desde $${coupon.minTotal.toLocaleString('es-AR')}.` };
    }
    if (!['PERCENT', 'FIXED'].includes(coupon.type) || !(coupon.value > 0)) {
        return { ok: false, reason: 'El cupón no es válido.' };
    }
    return { ok: true };
}

// Descuento del cupón calculado SIEMPRE sobre el total base del carrito
// (se acumula con el descuento por transferencia, que también se calcula sobre la base).
export function computeCouponDiscount(coupon: CouponLike, baseTotal: number): number {
    const discount = coupon.type === 'PERCENT'
        ? baseTotal * (Math.min(coupon.value, 100) / 100)
        : coupon.value;
    // Nunca descontar más que el total
    return Math.min(Math.round(discount), baseTotal);
}

export function normalizeCouponCode(code: string): string {
    return (code || '').trim().toUpperCase();
}
