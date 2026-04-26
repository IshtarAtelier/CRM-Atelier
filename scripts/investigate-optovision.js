// Investigate Optovision entries in detail
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find all products where brand contains optovision (case-insensitive)
    const optoProducts = await prisma.product.findMany({
        where: { brand: { contains: 'optovision', mode: 'insensitive' } },
        select: { id: true, brand: true, name: true, category: true, type: true, laboratory: true }
    });
    
    console.log('Products with brand containing "optovision":');
    optoProducts.forEach(p => {
        console.log(`  id:${p.id} | brand:"${p.brand}" | name:"${p.name}" | cat:${p.category} | type:${p.type} | lab:${p.laboratory}`);
    });

    // Also check for products where the brand field has trailing whitespace or invisible chars
    const allBrands = await prisma.product.findMany({
        select: { brand: true },
        where: { brand: { not: null } },
        distinct: ['brand'],
        orderBy: { brand: 'asc' }
    });
    
    console.log('\n\nAll distinct brands in database:');
    allBrands.forEach(p => {
        const b = p.brand;
        const hex = [...b].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
        console.log(`  "${b}" (length:${b.length}) [${hex}]`);
    });

    // Check brands that appear similar
    const brandCounts = {};
    const allProducts = await prisma.product.findMany({ select: { brand: true }, where: { brand: { not: null } } });
    allProducts.forEach(p => { brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1; });
    
    console.log('\n\nBrand counts:');
    Object.entries(brandCounts).sort((a, b) => a[0].localeCompare(b[0])).forEach(([brand, count]) => {
        console.log(`  "${brand}" → ${count} products`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
