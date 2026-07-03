import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

const VALID_TYPES = ['FIXED', 'PERCENT'];

async function requireAdmin() {
    const headersList = await headers();
    return headersList.get('x-user-role') === 'ADMIN';
}

// PATCH: Editar un cupón (código, valor, activar/desactivar, límites, vencimiento)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const data: any = {};

        if (body.code !== undefined) {
            const code = (body.code || '').trim().toUpperCase();
            if (!code) return NextResponse.json({ error: 'El código no puede quedar vacío.' }, { status: 400 });
            // Validar unicidad excluyendo el propio cupón
            const clash = await prisma.coupon.findFirst({ where: { code, id: { not: id } } });
            if (clash) return NextResponse.json({ error: 'Ya existe otro cupón con ese código.' }, { status: 400 });
            data.code = code;
        }

        if (body.discountType !== undefined) {
            if (!VALID_TYPES.includes(body.discountType)) {
                return NextResponse.json({ error: 'Tipo de descuento inválido.' }, { status: 400 });
            }
            data.discountType = body.discountType;
        }

        if (body.discountValue !== undefined) {
            const v = Number(body.discountValue);
            if (!v || v <= 0) return NextResponse.json({ error: 'El valor del descuento debe ser mayor a 0.' }, { status: 400 });
            const type = data.discountType || body.discountType;
            if (type === 'PERCENT' && v > 100) {
                return NextResponse.json({ error: 'El porcentaje no puede superar 100%.' }, { status: 400 });
            }
            data.discountValue = v;
        }

        if (body.isActive !== undefined) data.isActive = !!body.isActive;
        if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        if (body.maxUses !== undefined) data.maxUses = body.maxUses != null && body.maxUses !== '' ? Number(body.maxUses) : null;
        if (body.minOrderAmount !== undefined) data.minOrderAmount = body.minOrderAmount != null && body.minOrderAmount !== '' ? Number(body.minOrderAmount) : 0;

        const coupon = await prisma.coupon.update({ where: { id }, data });
        return NextResponse.json({ success: true, coupon });
    } catch (error: any) {
        console.error('Error updating coupon:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Eliminar un cupón
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }
        const { id } = await params;
        await prisma.coupon.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting coupon:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
