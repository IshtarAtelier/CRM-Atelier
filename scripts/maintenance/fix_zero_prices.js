// Script to remove products that were imported with $0 price (bad CSV parse)
const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function main() {
    // Find all products with price = 0 AND cost = 0 (these were the broken imports)
    const zeroProducts = await prisma.product.findMany({
        where: {
            price: 0,
            cost: 0,
        },
        select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            type: true,
            _count: { select: { orderItems: true } },
        },
    });

    console.log(`\n🔍 Encontrados ${zeroProducts.length} productos con precio $0 y costo $0:\n`);

    // Separate those with orders (can't delete) from those without
    const canDelete = [];
    const cannotDelete = [];

    for (const p of zeroProducts) {
        const label = `  ${p.brand || '?'} | ${(p.name || '?').substring(0, 60)} | ${p.category} | ${p.type || '-'}`;
        if (p._count.orderItems > 0) {
            cannotDelete.push(p);
            console.log(`  ⚠️  EN USO (${p._count.orderItems} items): ${label}`);
        } else {
            canDelete.push(p);
            console.log(`  🗑️  ${label}`);
        }
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   Eliminables: ${canDelete.length}`);
    console.log(`   En uso (no se eliminan): ${cannotDelete.length}`);

    if (canDelete.length === 0) {
        console.log('\n✅ No hay productos para eliminar.');
        return;
    }

    // Delete the ones without orders
    const deleteIds = canDelete.map(p => p.id);
    const result = await prisma.product.deleteMany({
        where: { id: { in: deleteIds } },
    });

    console.log(`\n✅ Eliminados ${result.count} productos con precio $0.`);
    console.log('   Ahora podés re-subir el CSV y se importarán con los precios correctos.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
