const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    // Crystal types
    const types = await p.product.groupBy({ by: ['type'], where: { category: 'Cristal' }, _count: true });
    console.log('Crystal types:');
    types.forEach(t => console.log('  ' + t.type + ': ' + t._count));

    // Categories
    const cats = await p.product.groupBy({ by: ['category'], _count: true });
    console.log('\nAll categories:');
    cats.forEach(c => console.log('  ' + c.category + ': ' + c._count));

    // Sunglasses
    const sunglasses = await p.product.findMany({ where: { category: { contains: 'Sol' } }, select: { id: true, brand: true, model: true, name: true, price: true } });
    console.log('\nSunglasses (' + sunglasses.length + '):');
    sunglasses.forEach(s => console.log('  ' + (s.brand || '') + ' ' + (s.model || '') + ' | ' + (s.name || '') + ' | $' + s.price));

    // Non-crystal, non-frame products
    const other = await p.product.findMany({ where: { category: { not: 'Cristal' } }, select: { id: true, category: true, brand: true, model: true, name: true, price: true, type: true } });
    console.log('\nNon-crystal products (' + other.length + '):');
    other.forEach(o => console.log('  ' + o.category + ' | ' + (o.brand || '') + ' ' + (o.model || '') + ' | ' + (o.name || '') + ' | ' + (o.type || '') + ' | $' + o.price));
}

main().finally(() => p.$disconnect());
