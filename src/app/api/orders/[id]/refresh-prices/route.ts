import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateQuoteTotals } from '@/services/PricingService';

// POST /api/orders/[id]/refresh-prices — Update order item prices to current product prices
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: { include: { product: true } },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }

        if (order.orderType === 'SALE') {
            return NextResponse.json({ error: 'No se pueden actualizar precios de una venta' }, { status: 400 });
        }

        // Compare and update each item's price
        const changes: { itemId: string; productName: string; oldPrice: number; newPrice: number }[] = [];

        for (const item of order.items) {
            const product = item.product;
            if (!product) continue; // Skip if product was deleted

            // Crystals sold per eye have item.eye set. Their unit price is product price / 2
            let currentPrice = product.price;
            if (item.eye) {
                currentPrice = Math.round(product.price / 2);
            } else if (product.unitType === 'PAR') {
                currentPrice = product.price;
            }

            if (item.price !== currentPrice) {
                changes.push({
                    itemId: item.id,
                    productName: `${product.brand || ''} ${product.name || ''}`.trim(),
                    oldPrice: item.price,
                    newPrice: currentPrice,
                });
            }
        }

        if (changes.length === 0) {
            return NextResponse.json({ updated: false, message: 'Los precios ya están actualizados', changes: [] });
        }

        // Apply updates in a transaction
        await prisma.$transaction(async (tx) => {
            await Promise.all(
                changes.map((change) =>
                    tx.orderItem.update({
                        where: { id: change.itemId },
                        data: { price: change.newPrice },
                    })
                )
            );

            // Recalcular con la MISMA fórmula que crea/edita presupuestos
            // (calculateQuoteTotals): contempla markup, descuento por método,
            // descuento especial y promos, y actualiza también subtotalWithMarkup.
            // La fórmula anterior (subtotal − discount%) ignoraba todo eso y dejaba
            // subtotalWithMarkup desincronizado → saldos y PDF inconsistentes.
            const updatedItems = await tx.orderItem.findMany({
                where: { orderId: id },
                include: { product: true },
            });
            const totals = calculateQuoteTotals(
                updatedItems,
                order.markup || 0,
                order.discountCash || 0,
                updatedItems.map((i: any) => i.product).filter(Boolean),
                order.specialDiscount || 0,
            );

            await tx.order.update({
                where: { id },
                data: {
                    subtotalWithMarkup: totals.subtotalWithMarkup,
                    total: totals.totalCash,
                    specialDiscount: totals.specialDiscountAmount,
                    appliedPromoName: totals.appliedPromoName,
                    appliedPromoDiscount: totals.promoFrameDiscount,
                },
            });
        });

        return NextResponse.json({ updated: true, changes });
    } catch (error: any) {
        console.error('Error refreshing prices:', error);
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
