import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { snapshotFromProduct } from '@/lib/order-snapshot';
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

        // Blindaje del histórico: si el producto tiene ventas, congelamos la foto (nombre,
        // marca, categoría, costo, laboratorio) en cada línea que aún no la tenga ANTES de
        // borrar. Al borrar, la FK (ON DELETE SET NULL) desvincula el producto, pero la venta
        // conserva qué se vendió y a qué costo. Así nunca se pierde nada del histórico.
        const prod = await prisma.product.findUnique({ where: { id } });
        if (!prod) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
        }

        await prisma.$transaction([
            prisma.orderItem.updateMany({
                where: { productId: id, productNameSnapshot: null },
                data: snapshotFromProduct(prod),
            }),
            prisma.product.delete({ where: { id } }),
        ]);

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
        const headersList = await headers();
        const role = headersList.get('x-user-role') || 'STAFF';
        if (role !== 'ADMIN' && role !== 'MANAGER') {
            return NextResponse.json({ error: 'No autorizado para editar medidas del producto' }, { status: 403 });
        }
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
