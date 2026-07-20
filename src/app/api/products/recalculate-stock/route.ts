import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getActor } from '@/lib/actor';
import { logAudit } from '@/lib/audit';

// POST /api/products/recalculate-stock
// Recalculates stock for all non-crystal products based on sold quantities.
// This one-time endpoint corrects stock for sales made before the stock
// decrement system was implemented.
// ⚠️ NO idempotente: cada corrida vuelve a restar TODO lo vendido histórico al
// stock actual. Solo ADMIN y con confirmación explícita.
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        if (role !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        if (searchParams.get('confirm') !== 'yes') {
            return NextResponse.json({
                error: 'Endpoint destructivo y no idempotente: cada corrida resta de nuevo todas las ventas históricas al stock actual. Si estás seguro, repetí la llamada con ?confirm=yes.',
            }, { status: 400 });
        }
        // Get all SALE orders (not deleted) with their items
        const saleOrders = await prisma.order.findMany({
            where: {
                orderType: 'SALE',
                isDeleted: false,
            },
            include: {
                items: {
                    include: { product: true },
                },
            },
        });

        // Aggregate sold quantities per product (excluding crystals)
        const soldMap = new Map<string, number>();
        for (const order of saleOrders) {
            for (const item of order.items) {
                const p = item.product;
                if (!p) continue;
                const isCrystal = p.category === 'Cristal' || (p.type || '').includes('Cristal');
                if (isCrystal) continue;

                soldMap.set(p.id, (soldMap.get(p.id) || 0) + item.quantity);
            }
        }

        // Get all non-crystal products to check their original stock
        const allProducts = await prisma.product.findMany({
            where: {
                NOT: [
                    { category: 'Cristal' },
                ],
            },
        });

        const updates: { id: string; name: string; oldStock: number; soldQty: number; newStock: number }[] = [];

        for (const product of allProducts) {
            const isCrystal = product.category === 'Cristal' || (product.type || '').includes('Cristal');
            if (isCrystal) continue;

            const soldQty = soldMap.get(product.id) || 0;
            if (soldQty === 0) continue;

            const newStock = Math.max(0, product.stock - soldQty);
            const name = `${product.brand || ''} ${product.name || ''}`.trim();

            updates.push({
                id: product.id,
                name,
                oldStock: product.stock,
                soldQty,
                newStock,
            });
        }

        // Apply updates in a transaction
        if (updates.length > 0) {
            await prisma.$transaction(
                updates.map(u =>
                    prisma.product.update({
                        where: { id: u.id },
                        data: { stock: u.newStock },
                    })
                )
            );
        }

        const actor = getActor(request);
        await logAudit({
            userId: actor.id,
            userName: actor.name,
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: 'recalculate-stock',
            details: {
                descripcion: `Recálculo masivo de stock (${updates.length} productos afectados)`,
                updates: updates.map(u => ({ id: u.id, name: u.name, oldStock: u.oldStock, newStock: u.newStock })),
            },
        });

        return NextResponse.json({
            message: `Stock recalculado para ${updates.length} productos`,
            updates,
        });
    } catch (error: any) {
        console.error('Error recalculating stock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
