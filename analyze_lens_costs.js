const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    // We assume the user is looking at the current month data (April 2026)
    const now = new Date('2026-04-11');
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const orders = await prisma.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
            createdAt: {
                gte: from,
                lte: to
            }
        },
        include: {
            items: {
                include: {
                    product: true
                }
            }
        }
    });

    let totalCostLenses = 0;
    const itemsByProduct = {};

    for (const order of orders) {
        for (const item of order.items) {
            const product = item.product;
            if (!product) continue;

            const cat = (product.category || '').toUpperCase();
            const type = (product.type || '').toLowerCase();
            const isLens = cat.includes('LENS') || 
                           type.includes('cristal') || 
                           type.includes('multifocal') || 
                           type.includes('monofocal');

            if (isLens) {
                const itemCost = (product.cost || 0) * item.quantity;
                totalCostLenses += itemCost;

                const pName = `${product.brand || ''} ${product.model || product.name || 'Sin nombre'}`.trim();
                const key = `${pName} (${product.type || 'LENTE'})`;
                if (!itemsByProduct[key]) itemsByProduct[key] = { cost: 0, qty: 0 };
                itemsByProduct[key].cost += itemCost;
                itemsByProduct[key].qty += item.quantity;
            }
        }
    }

    console.log(`TOTAL_LENS_COST: ${totalCostLenses}`);
    console.log('--- BREAKDOWN ---');
    const sorted = Object.entries(itemsByProduct).sort((a, b) => b[1].cost - a[1].cost);
    sorted.slice(0, 20).forEach(([name, data]) => {
        console.log(`${name}: $${data.cost} (${data.qty} u)`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
