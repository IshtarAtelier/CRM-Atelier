import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { normalizeCouponCode } from '@/lib/checkout/coupon-utils';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
    const headersList = await headers();
    return headersList.get('x-user-role') === 'ADMIN';
}

// GET /api/coupons — listar cupones (solo admin)
export async function GET() {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: 'Solo el administrador puede gestionar cupones.' }, { status: 403 });
    }
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ coupons });
}

// POST /api/coupons — crear cupón (solo admin)
export async function POST(req: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Solo el administrador puede gestionar cupones.' }, { status: 403 });
        }
        const body = await req.json();
        const code = normalizeCouponCode(body.code);
        const type = body.type === 'FIXED' ? 'FIXED' : 'PERCENT';
        const value = Number(body.value);

        if (!code || code.length < 3) {
            return NextResponse.json({ error: 'El código debe tener al menos 3 caracteres.' }, { status: 400 });
        }
        if (!(value > 0)) {
            return NextResponse.json({ error: 'El valor del descuento debe ser mayor a 0.' }, { status: 400 });
        }
        if (type === 'PERCENT' && value > 100) {
            return NextResponse.json({ error: 'Un porcentaje no puede superar 100.' }, { status: 400 });
        }

        const coupon = await prisma.coupon.create({
            data: {
                code,
                type,
                value,
                active: body.active !== false,
                expiresAt: body.expiresAt ? new Date(body.expiresAt + 'T23:59:59') : null,
                maxUses: body.maxUses ? Number(body.maxUses) : null,
                minTotal: body.minTotal ? Number(body.minTotal) : null
            }
        });
        return NextResponse.json({ coupon });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 400 });
        }
        console.error('[COUPONS] Error creando cupón:', error);
        return NextResponse.json({ error: error.message || 'Error creando el cupón.' }, { status: 500 });
    }
}
