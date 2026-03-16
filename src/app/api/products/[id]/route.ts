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

        // Check if product has associated order items
        const orderItemCount = await prisma.orderItem.count({
            where: { productId: id }
        });

        if (orderItemCount > 0) {
            return NextResponse.json({
                error: `No se puede eliminar: este producto está asociado a ${orderItemCount} venta(s). Considere desactivar el producto en su lugar.`
            }, { status: 400 });
        }

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

