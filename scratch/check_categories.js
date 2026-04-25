const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // Count products by category
    const cats = await p.product.groupBy({
        by: ['category'],
        _count: { id: true }
    });
    console.log('\n=== PRODUCTOS POR CATEGORÍA ===');
    cats.forEach(c => console.log(`  ${c.category}: ${c._count.id} productos`));

    // Check if any have 'Cristal' category
    const cristalProducts = await p.product.findMany({
        where: { category: 'Cristal' },
        select: { id: true, name: true, brand: true, category: true, type: true }
    });
    console.log(`\n=== PRODUCTOS CON category='Cristal' (${cristalProducts.length}) ===`);
    cristalProducts.forEach(p => console.log(`  ${p.brand || ''} ${p.name || ''} | type=${p.type} | category=${p.category}`));

    // Check LENS products
    const lensCount = await p.product.count({ where: { category: 'LENS' } });
    console.log(`\n=== PRODUCTOS CON category='LENS': ${lensCount} ===`);

    // Check orders that reference products with category='Cristal'
    const ordersWithCristal = await p.orderItem.findMany({
        where: { product: { category: 'Cristal' } },
        select: { orderId: true, product: { select: { name: true, brand: true, category: true } } }
    });
    const uniqueOrders = new Set(ordersWithCristal.map(o => o.orderId));
    console.log(`\n=== VENTAS AFECTADAS (con productos category='Cristal'): ${uniqueOrders.size} ventas ===`);

    await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
