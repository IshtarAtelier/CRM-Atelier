import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
    const headersList = await headers();
    return headersList.get('x-user-role') === 'ADMIN';
}

// PATCH /api/coupons/[id] — editar cupón (activar/desactivar, límites)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Solo el administrador puede gestionar cupones.' }, { status: 403 });
        }
        const { id } = await params;
        const body = await req.json();
        const data: any = {};
        if (typeof body.active === 'boolean') data.active = body.active;
        if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt + 'T23:59:59') : null;
        if (body.maxUses !== undefined) data.maxUses = body.maxUses ? Number(body.maxUses) : null;
        if (body.minTotal !== undefined) data.minTotal = body.minTotal ? Number(body.minTotal) : null;
        if (body.value !== undefined && Number(body.value) > 0) data.value = Number(body.value);

        const coupon = await prisma.coupon.update({ where: { id }, data });
        return NextResponse.json({ coupon });
    } catch (error: any) {
        console.error('[COUPONS] Error editando cupón:', error);
        return NextResponse.json({ error: error.message || 'Error editando el cupón.' }, { status: 500 });
    }
}

// DELETE /api/coupons/[id] — eliminar cupón
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!(await requireAdmin())) {
            return NextResponse.json({ error: 'Solo el administrador puede gestionar cupones.' }, { status: 403 });
        }
        const { id } = await params;
        await prisma.coupon.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[COUPONS] Error eliminando cupón:', error);
        return NextResponse.json({ error: error.message || 'Error eliminando el cupón.' }, { status: 500 });
    }
}
