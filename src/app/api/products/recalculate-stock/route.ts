import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/products/recalculate-stock
// Recalculates stock for all non-crystal products based on sold quantities.
// This one-time endpoint corrects stock for sales made before the stock 
// decrement system was implemented.
export async function POST() {
    try {
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
            const name = `${product.brand || ''} ${product.model || product.name || ''}`.trim();

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

        return NextResponse.json({
            message: `Stock recalculado para ${updates.length} productos`,
            updates,
        });
    } catch (error: any) {
        console.error('Error recalculating stock:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
