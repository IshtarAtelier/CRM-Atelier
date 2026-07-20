import { prisma } from '@/lib/db';

export interface CouponValidation {
    valid: boolean;
    reason?: string;
    discountAmount: number;
    coupon?: {
        code: string;
        discountType: string;
        discountValue: number;
    };
}

/**
 * Valida un cupón contra un subtotal y devuelve el monto de descuento a aplicar.
 * ES LA FUENTE DE VERDAD: se usa tanto en el endpoint público de validación como
 * en el checkout real. El front nunca decide el monto; solo lo muestra.
 *
 * @param rawCode  Código tipeado por el cliente (se normaliza a MAYÚSCULAS).
 * @param subtotal Subtotal (en $) sobre el que se calcula el descuento.
 */
export async function validateCoupon(rawCode: string, subtotal: number): Promise<CouponValidation> {
    const code = (rawCode || '').trim().toUpperCase();

    if (!code) {
        return { valid: false, reason: 'Ingresá un código de descuento.', discountAmount: 0 };
    }

    const coupon = await prisma.coupon.findUnique({ where: { code } });

    if (!coupon) {
        return { valid: false, reason: 'El código no existe.', discountAmount: 0 };
    }

    if (!coupon.isActive) {
        return { valid: false, reason: 'Este cupón no está activo.', discountAmount: 0 };
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        return { valid: false, reason: 'Este cupón está vencido.', discountAmount: 0 };
    }

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, reason: 'Este cupón alcanzó su límite de usos.', discountAmount: 0 };
    }

    const minOrder = coupon.minOrderAmount ?? 0;
    if (minOrder > 0 && subtotal < minOrder) {
        return {
            valid: false,
            reason: `Este cupón requiere una compra mínima de $${minOrder.toLocaleString('es-AR')}.`,
            discountAmount: 0,
        };
    }

    // Cálculo del descuento (nunca puede superar el subtotal)
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENT') {
        discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
    } else {
        // FIXED
        discountAmount = Math.round(coupon.discountValue);
    }
    discountAmount = Math.max(0, Math.min(discountAmount, Math.round(subtotal)));

    return {
        valid: true,
        discountAmount,
        coupon: {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
        },
    };
}

/**
 * Incrementa el contador de usos de un cupón. No lanza: solo loguea si falla,
 * para que un problema de conteo nunca rompa un checkout ya cobrado.
 */
export async function incrementCouponUsage(code: string): Promise<void> {
    try {
        const normalized = code.trim().toUpperCase();
        const coupon = await prisma.coupon.findUnique({ where: { code: normalized }, select: { maxUses: true } });
        if (!coupon) return;
        if (coupon.maxUses == null) {
            await prisma.coupon.update({
                where: { code: normalized },
                data: { usedCount: { increment: 1 } },
            });
            return;
        }
        // Incremento atómico condicionado: solo si aún hay usos disponibles. Evita
        // superar maxUses en checkouts concurrentes (dos válidos que ven usedCount igual).
        const result = await prisma.coupon.updateMany({
            where: { code: normalized, usedCount: { lt: coupon.maxUses } },
            data: { usedCount: { increment: 1 } },
        });
        if (result.count === 0) {
            console.warn('[coupons] Cupón', normalized, 'ya alcanzó su límite de usos; no se incrementó.');
        }
    } catch (err: any) {
        console.error('[coupons] No se pudo incrementar usedCount para', code, err?.message);
    }
}
