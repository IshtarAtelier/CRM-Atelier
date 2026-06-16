const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const fromDate = new Date('2026-06-01T00:00:00.000Z');
        const toDate = new Date('2026-06-12T23:59:59.999Z');

        const orderItems = await prisma.orderItem.findMany({
            where: {
                order: {
                    orderType: 'SALE',
                    isDeleted: false,
                    OR: [
                        { labSentAt: { gte: fromDate, lte: toDate } },
                        {
                            AND: [
                                { labSentAt: null },
                                { createdAt: { gte: fromDate, lte: toDate } }
                            ]
                        }
                    ]
                }
            },
            include: { 
                product: true, 
                order: { 
                    select: { 
                        id: true, 
                        appliedPromoName: true,
                        tags: true 
                    } 
                } 
            }
        });

        // Group by order to simulate the actual order flow
        const ordersMap = new Map();
        for (const item of orderItems) {
            if (!ordersMap.has(item.order.id)) {
                ordersMap.set(item.order.id, {
                    ...item.order,
                    items: []
                });
            }
            ordersMap.get(item.order.id).items.push(item);
        }

        let totalLensesCost = 0;
        console.log('--- OrderItems in June 2026 (FIXED) ---');
        
        for (const order of ordersMap.values()) {
            let orderLensesCost = 0;
            let paidCrystalsCount = 0;

            const has2x1Tag = order.tags?.some((t) => t.name.toLowerCase().includes('2x1')) || false;
            const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag;

            for (const item of order.items) {
                const product = item.product;
                if (!product) continue;

                const isCrystalItem = (product.category || '').toUpperCase().includes('CRISTAL')
                    || (product.type || '').includes('Cristal')
                    || (product.type || '').includes('Multifocal')
                    || (product.type || '').includes('Monofocal');

                let itemCost = (product.cost || 0) * item.quantity;
                
                if (isCrystalItem && product.unitType !== 'UNIDAD' && (item.eye === 'OD' || item.eye === 'OI') && (product.cost || 0) > 0) {
                    itemCost = ((product.cost || 0) / 2) * item.quantity;
                }

                if (is2x1Order && isCrystalItem) {
                    if (item.price === 0) {
                        itemCost = 0;
                    } else {
                        if (paidCrystalsCount >= 2) {
                            itemCost = 0;
                        } else if (paidCrystalsCount + item.quantity > 2) {
                            const payableQty = 2 - paidCrystalsCount;
                            itemCost = (itemCost / item.quantity) * payableQty;
                        }
                        paidCrystalsCount += item.quantity;
                    }
                }

                if (isCrystalItem) {
                    orderLensesCost += itemCost;
                }
            }
            totalLensesCost += orderLensesCost;
        }

        console.log(`\nFixed Total Lenses Cost: ${totalLensesCost}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
