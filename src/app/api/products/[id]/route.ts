import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { ProductService } from '@/services/product.service';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Only ADMIN can delete products
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede eliminar productos' }, { status: 403 });
        }

        const { id } = await params;

        await prisma.product.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting product:', error);
        return NextResponse.json({
            error: 'Error al eliminar producto',
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Only ADMIN can edit products
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Solo el administrador puede editar productos' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const product = await ProductService.update(id, body);
        return NextResponse.json(product);
    } catch (error: any) {
        console.error('Error updating product:', error);
        return NextResponse.json({
            error: 'Error al actualizar producto',
            details: error.message
        }, { status: 500 });
    }
}

// PATCH público — solo para actualizar medidas del armazón desde la web
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const { lensWidth, bridgeWidth, templeLength, frameHeight } = body;

        const updated = await prisma.product.update({
            where: { id },
            data: {
                ...(lensWidth !== undefined && { lensWidth: lensWidth ? parseInt(lensWidth) : null }),
                ...(bridgeWidth !== undefined && { bridgeWidth: bridgeWidth ? parseInt(bridgeWidth) : null }),
                ...(templeLength !== undefined && { templeLength: templeLength ? parseInt(templeLength) : null }),
                ...(frameHeight !== undefined && { frameHeight: frameHeight ? parseInt(frameHeight) : null }),
            },
        });
        return NextResponse.json({ success: true, id: updated.id });
    } catch (error: any) {
        console.error('Error updating frame measures:', error);
        return NextResponse.json({ error: 'Error al guardar medidas', details: error.message }, { status: 500 });
    }
}
