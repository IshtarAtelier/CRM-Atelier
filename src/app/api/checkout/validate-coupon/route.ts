import { NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

// Público: el checkout de la tienda lo llama para mostrar el descuento en vivo.
// El monto real se vuelve a validar y calcular en /api/checkout/payway (fuente de verdad).
export async function POST(req: Request) {
    try {
        const { code, subtotal } = await req.json();

        const numericSubtotal = Number(subtotal) || 0;
        if (numericSubtotal <= 0) {
            return NextResponse.json({ valid: false, reason: 'Tu carrito está vacío.' }, { status: 400 });
        }

        const result = await validateCoupon(code, numericSubtotal);

        if (!result.valid) {
            return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 });
        }

        return NextResponse.json({
            valid: true,
            discountAmount: result.discountAmount,
            code: result.coupon!.code,
            discountType: result.coupon!.discountType,
            discountValue: result.coupon!.discountValue,
        });
    } catch (error: any) {
        console.error('[validate-coupon] Error:', error?.message);
        return NextResponse.json({ valid: false, reason: 'No se pudo validar el cupón.' }, { status: 500 });
    }
}
