import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';

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
 * Interpreta la fecha de vencimiento que carga el admin.
 *
 * El input date del panel manda "YYYY-MM-DD", y `new Date("YYYY-MM-DD")` es
 * medianoche UTC: el cupón "vencía" al EMPEZAR el día elegido, y encima 3 horas
 * antes en Argentina. Así nació muerto QUIEROMISLENTES el 13/8/2026: se creó
 * con vencimiento "hoy" y ya estaba vencido. La fecha elegida tiene que valer
 * el día ENTERO en hora argentina: se guarda como 23:59:59 -03:00.
 * Si viene un ISO con hora explícita, se respeta tal cual.
 */
export function parseVencimientoCupon(input: unknown): Date | null {
    if (!input || typeof input !== 'string') return null;
    const v = input.trim();
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T23:59:59-03:00`);
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Vencimiento por default cuando el admin no eligió ninguno: HOY + 2 meses.
 *
 * Antes un cupón sin fecha quedaba SIN VENCIMIENTO para siempre — un código
 * vivo indefinidamente es fácil de olvidar activo. Pedido de Ishtar 25/8/26:
 * todo cupón nuevo nace con 2 meses de vida salvo que se cargue otra fecha a
 * mano; el cron `coupon-expired` avisa cuando se cumple, para decidir si sale
 * uno nuevo.
 */
export function vencimientoPorDefecto(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    d.setHours(23, 59, 59, 0);
    return d;
}

/**
 * Registra un intento de cupón que NO se pudo usar: antes el checkout le
 * decía al cliente "vencido" o "no existe" y no quedaba ningún rastro en
 * ningún lado — un cupón roto (como el bug de vencimiento del 13/8/2026) podía
 * estar rechazando ventas reales sin que nadie se enterara. Fire-and-forget:
 * un problema de auditoría no puede voltear el checkout.
 */
function registrarIntentoFallido(code: string, reason: string, subtotal: number, couponId?: string) {
    logAudit({
        userId: null,
        userName: 'Sistema (checkout)',
        action: 'ATTEMPT_FAILED',
        entityType: 'COUPON',
        entityId: couponId || code,
        details: { evento: 'cupon_rechazado_en_checkout', code, reason, subtotal },
    }).catch(err => console.error('[coupons] No se pudo registrar el intento fallido:', err));
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
        registrarIntentoFallido(code, 'El código no existe.', subtotal);
        return { valid: false, reason: 'El código no existe.', discountAmount: 0 };
    }

    if (!coupon.isActive) {
        registrarIntentoFallido(code, 'Este cupón no está activo.', subtotal, coupon.id);
        return { valid: false, reason: 'Este cupón no está activo.', discountAmount: 0 };
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
        registrarIntentoFallido(code, 'Este cupón está vencido.', subtotal, coupon.id);
        return { valid: false, reason: 'Este cupón está vencido.', discountAmount: 0 };
    }

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        registrarIntentoFallido(code, 'Este cupón alcanzó su límite de usos.', subtotal, coupon.id);
        return { valid: false, reason: 'Este cupón alcanzó su límite de usos.', discountAmount: 0 };
    }

    const minOrder = coupon.minOrderAmount ?? 0;
    if (minOrder > 0 && subtotal < minOrder) {
        const reason = `Este cupón requiere una compra mínima de $${minOrder.toLocaleString('es-AR')}.`;
        registrarIntentoFallido(code, reason, subtotal, coupon.id);
        return { valid: false, reason, discountAmount: 0 };
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
        await prisma.coupon.update({
            where: { code: code.trim().toUpperCase() },
            data: { usedCount: { increment: 1 } },
        });
    } catch (err: any) {
        console.error('[coupons] No se pudo incrementar usedCount para', code, err?.message);
    }
}
