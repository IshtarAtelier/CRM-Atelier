import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// DELETE /api/products/delete-all — Remove all products (clears OrderItems first)
export async function DELETE(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol ADMIN.' }, { status: 403 });
        }

        // First delete all OrderItems referencing products
        // First delete all OrderItems referencing products
        const deletedItems = await prisma.orderItem.deleteMany({});
        
        // Then delete all products
        const deletedProducts = await prisma.product.deleteMany({});

        return NextResponse.json({
            success: true,
            message: `Se eliminaron ${deletedProducts.count} productos y ${deletedItems.count} items de órdenes.`,
            deletedProducts: deletedProducts.count,
            deletedOrderItems: deletedItems.count,
        });
    } catch (error: any) {
        console.error('Error deleting all products:', error);
        return NextResponse.json({ error: error.message || 'Error al eliminar' }, { status: 500 });
    }
}
