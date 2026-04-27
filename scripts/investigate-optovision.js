// Deep-check for invisible character differences in brand names
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allProducts = await prisma.product.findMany({
        select: { brand: true },
        where: { brand: { not: null } }
    });

    // Simulate frontend logic exactly
    const brands = allProducts.map(p => p.brand).filter(Boolean);
    const uniqueBrands = Array.from(new Set(brands)).sort();

    console.log('Unique brands (simulating frontend):');
    uniqueBrands.forEach((b, i) => {
        const bytes = Buffer.from(b, 'utf-8');
        console.log(`  [${i}] "${b}" len=${b.length} bytes=[${[...bytes].map(x => x.toString(16).padStart(2,'0')).join(' ')}]`);
    });

    // Check for any brand that appears close to "Optovision" in the sorted list
    const optoIdx = uniqueBrands.findIndex(b => b.toLowerCase().includes('opto'));
    if (optoIdx >= 0) {
        console.log(`\nOptovision found at index ${optoIdx}`);
        // Show surrounding entries
        for (let i = Math.max(0, optoIdx - 2); i <= Math.min(uniqueBrands.length - 1, optoIdx + 2); i++) {
            console.log(`  [${i}] "${uniqueBrands[i]}"`);
        }
    }
    
    // Now check: does the ProductService.getAll() add any extra brands?
    const productCount = await prisma.product.count();
    console.log(`\nTotal products: ${productCount}`);
    
    // Check if there's a brand that's OPTOVISION (uppercase) vs Optovision (title case)
    const optoBrands = allProducts.filter(p => p.brand && p.brand.toLowerCase() === 'optovision');
    console.log(`\nProducts with brand "optovision" (case-insensitive): ${optoBrands.length}`);
    const optoVariants = [...new Set(optoBrands.map(p => p.brand))];
    console.log(`Variants: ${optoVariants.map(v => `"${v}" (${v.length} chars)`).join(', ')}`);
    
    // Maybe the "laboratory" is leaking into the brand field?
    const labOptovision = await prisma.product.findMany({
        where: { laboratory: 'OPTOVISION' },
        select: { brand: true, laboratory: true },
        distinct: ['brand']
    });
    console.log('\nDistinct brands for products with lab=OPTOVISION:');
    labOptovision.forEach(p => console.log(`  brand="${p.brand}" lab="${p.laboratory}"`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
