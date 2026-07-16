import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

// DELETE /api/products/delete-all — Borra TODOS los productos SIN tocar el historial de ventas.
// El trigger de la base (freeze_orderitem_snapshot) congela la foto de cada producto en sus
// líneas de venta antes de borrarlo, y la FK ON DELETE SET NULL preserva las líneas. Las ventas
// quedan intactas. (Antes este endpoint borraba TODOS los OrderItems primero — destruía el
// historial completo. Ya no.)
export async function DELETE(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso denegado. Se requiere rol ADMIN.' }, { status: 403 });
        }

        const count = await prisma.product.count();
        const deletedProducts = await prisma.product.deleteMany({});

        // Trazabilidad: quién vació el catálogo y cuántos productos había
        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'DELETE',
            entityType: 'PRODUCT',
            entityId: 'ALL',
            details: { count },
        });

        return NextResponse.json({
            success: true,
            message: `Se eliminaron ${deletedProducts.count} productos. El historial de ventas quedó intacto.`,
            deletedProducts: deletedProducts.count,
        });
    } catch (error: any) {
        console.error('Error deleting all products:', error);
        return NextResponse.json({ error: error.message || 'Error al eliminar' }, { status: 500 });
    }
}
