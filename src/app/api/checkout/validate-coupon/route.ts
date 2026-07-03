import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateCoupon, computeCouponDiscount, normalizeCouponCode } from '@/lib/checkout/coupon-utils';

export const dynamic = 'force-dynamic';

// POST /api/checkout/validate-coupon — público (ruta de checkout)
// Valida un cupón contra el total del carrito y devuelve el descuento calculado.
export async function POST(req: Request) {
    try {
        const { code, total } = await req.json();
        const normalized = normalizeCouponCode(code);
        if (!normalized) {
            return NextResponse.json({ valid: false, error: 'Ingresá un código de cupón.' }, { status: 400 });
        }
        const cartTotal = Number(total) || 0;

        const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
        const check = validateCoupon(coupon, cartTotal);
        if (!check.ok || !coupon) {
            return NextResponse.json({ valid: false, error: check.reason }, { status: 400 });
        }

        const discount = computeCouponDiscount(coupon, cartTotal);
        return NextResponse.json({
            valid: true,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            discount
        });
    } catch (error: any) {
        console.error('[VALIDATE COUPON] Error:', error);
        return NextResponse.json({ valid: false, error: 'Error validando el cupón.' }, { status: 500 });
    }
}
