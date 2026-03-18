const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    // Check OPTOVISION products
    const optovision = await p.product.findMany({
        where: { laboratory: 'OPTOVISION' },
        select: { id: true, brand: true, name: true, type: true, category: true, lensIndex: true, stock: true, cost: true, price: true, laboratory: true, unitType: true },
        take: 5
    });
    console.log('OPTOVISION products (first 5):');
    optovision.forEach(o => console.log(JSON.stringify(o)));

    // Check all distinct type/category combos
    const types = await p.product.groupBy({ by: ['type', 'category'], _count: { _all: true } });
    console.log('\nAll type/category combos:');
    types.forEach(t => console.log('  ' + t.category + ' / ' + t.type + ': ' + t._count._all));

    // Check Sygnus products
    const sygnus = await p.product.findMany({
        where: { brand: 'Sygnus' },
        select: { id: true, brand: true, name: true, type: true, category: true, stock: true, cost: true, price: true, laboratory: true },
        take: 5
    });
    console.log('\nSygnus products (first 5):');
    sygnus.forEach(o => console.log(JSON.stringify(o)));

    // Check products with 0 stock and laboratory set
    const zeroStockLab = await p.product.count({
        where: { stock: 0, laboratory: { not: null } }
    });
    console.log('\nProducts with stock=0 and laboratory set:', zeroStockLab);

    // Check products with null laboratory in crystal category
    const nullLabCrystal = await p.product.count({
        where: { category: 'Cristal', laboratory: null }
    });
    console.log('Crystal products with null laboratory:', nullLabCrystal);
}

main().finally(() => p.$disconnect());
