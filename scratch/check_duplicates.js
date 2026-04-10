const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany();
    const nameMap = {};
    const duplicates = [];

    products.forEach(p => {
        const key = `${p.brand}|${p.name}`;
        if (nameMap[key]) {
            duplicates.push({ existing: nameMap[key], duplicate: p });
        } else {
            nameMap[key] = p;
        }
    });

    console.log(`Found ${duplicates.length} total duplicates by Brand|Name`);
    duplicates.forEach(d => {
        console.log(`Duplicate found:`);
        console.log(`  Existing: ID: ${d.existing.id} | Name: ${d.existing.name} | Brand: ${d.existing.brand} | Category: ${d.existing.category} | Price: ${d.existing.price}`);
        console.log(`  Duplicate: ID: ${d.duplicate.id} | Name: ${d.duplicate.name} | Brand: ${d.duplicate.brand} | Category: ${d.duplicate.category} | Price: ${d.duplicate.price}`);
    });

    // Also check for similar names for Comfort Max
    const comfortMax = products.filter(p => p.name && p.name.toUpperCase().includes('COMFORT MAX'));
    console.log(`\nComfort Max products found: ${comfortMax.length}`);
    comfortMax.forEach(p => {
        console.log(`ID: ${p.id} | Name: ${p.name} | Brand: ${p.brand} | Category: ${p.category} | Price: ${p.price}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
