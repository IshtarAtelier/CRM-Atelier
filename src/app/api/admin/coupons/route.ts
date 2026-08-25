import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';
import { parseVencimientoCupon, vencimientoPorDefecto } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['FIXED', 'PERCENT'];

async function requireAdmin() {
    const headersList = await headers();
    return headersList.get('x-user-role') === 'ADMIN';
}

// GET: Listar todos los cupones
export async function GET() {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
        return NextResponse.json(coupons);
    } catch (error: any) {
        console.error('Error fetching coupons:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Crear un cupón
export async function POST(request: Request) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const code = (body.code || '').trim().toUpperCase();
        const discountType = body.discountType || 'FIXED';
        const discountValue = Number(body.discountValue);

        if (!code) {
            return NextResponse.json({ error: 'El código es obligatorio.' }, { status: 400 });
        }
        if (!VALID_TYPES.includes(discountType)) {
            return NextResponse.json({ error: 'Tipo de descuento inválido.' }, { status: 400 });
        }
        if (!discountValue || discountValue <= 0) {
            return NextResponse.json({ error: 'El valor del descuento debe ser mayor a 0.' }, { status: 400 });
        }
        if (discountType === 'PERCENT' && discountValue > 100) {
            return NextResponse.json({ error: 'El porcentaje no puede superar 100%.' }, { status: 400 });
        }

        const existing = await prisma.coupon.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json({ error: 'Ya existe un cupón con ese código.' }, { status: 400 });
        }

        const coupon = await prisma.coupon.create({
            data: {
                code,
                discountType,
                discountValue,
                isActive: body.isActive !== undefined ? !!body.isActive : true,
                // Sin fecha elegida: 2 meses por default, no "sin vencimiento"
                // para siempre — un cupón vivo indefinidamente es fácil de
                // olvidar activo.
                expiresAt: parseVencimientoCupon(body.expiresAt) || vencimientoPorDefecto(),
                maxUses: body.maxUses != null && body.maxUses !== '' ? Number(body.maxUses) : null,
                minOrderAmount: body.minOrderAmount != null && body.minOrderAmount !== '' ? Number(body.minOrderAmount) : 0,
            },
        });

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'CREATE',
            entityType: 'COUPON',
            entityId: coupon.id,
            details: {
                descripcion: `Cupón "${coupon.code}" creado`,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                isActive: coupon.isActive,
                expiresAt: coupon.expiresAt,
                maxUses: coupon.maxUses,
                minOrderAmount: coupon.minOrderAmount,
            },
        });

        return NextResponse.json({ success: true, coupon });
    } catch (error: any) {
        console.error('Error creating coupon:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
