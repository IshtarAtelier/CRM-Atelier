// Check if "Optovision" exists as both a brand AND a laboratory 
// and if there are products where brand="Optovision" AND laboratory="OPTOVISION"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Check products where Optovision is brand
    const asBrand = await prisma.product.findMany({
        where: { brand: { contains: 'optovision', mode: 'insensitive' } },
        select: { id: true, brand: true, name: true, laboratory: true, category: true, type: true }
    });
    console.log(`Products with brand "Optovision": ${asBrand.length}`);
    asBrand.forEach(p => console.log(`  brand="${p.brand}" lab="${p.laboratory}" name="${p.name}" cat="${p.category}" type="${p.type}"`));
    
    // Check products where Optovision is laboratory
    const asLab = await prisma.product.findMany({
        where: { laboratory: { contains: 'optovision', mode: 'insensitive' } },
        select: { id: true, brand: true, name: true, laboratory: true, category: true, type: true }
    });
    console.log(`\nProducts with laboratory "Optovision": ${asLab.length}`);
    
    // Get unique brands from those lab-optovision products
    const brandsFromLabOptovision = [...new Set(asLab.map(p => p.brand))];
    console.log(`Brands of products from Lab OPTOVISION: ${brandsFromLabOptovision.join(', ')}`);
    
    // Now simulate what the frontend does - get ALL products, extract unique brands
    const allProducts = await prisma.product.findMany({
        select: { brand: true },
        orderBy: { brand: 'asc' }
    });
    
    const allBrands = allProducts.map(p => p.brand).filter(Boolean);
    const uniqueBrands = Array.from(new Set(allBrands)).sort();
    
    console.log('\n\nAll unique brands (as frontend sees them):');
    uniqueBrands.forEach(b => console.log(`  "${b}"`));
    
    // Check for near-duplicates
    const lowerMap = {};
    uniqueBrands.forEach(b => {
        const key = b.toLowerCase().trim();
        if (!lowerMap[key]) lowerMap[key] = [];
        lowerMap[key].push(b);
    });
    
    console.log('\n\nPotential duplicates (different casing):');
    Object.entries(lowerMap).forEach(([key, variants]) => {
        if (variants.length > 1) {
            console.log(`  "${key}" → ${variants.map(v => `"${v}"`).join(', ')}`);
        }
    });
    
    // Check what happens when filtering by category "Cristal" — since the page loads filtered products
    const cristalProducts = await prisma.product.findMany({
        where: { 
            OR: [
                { category: 'Cristal' },
                { category: 'CRISTAL' },
                { type: { startsWith: 'Cristal' } }
            ]
        },
        select: { brand: true }
    });
    const cristalBrands = Array.from(new Set(cristalProducts.map(p => p.brand).filter(Boolean))).sort();
    console.log('\n\nBrands for Cristal products:');
    cristalBrands.forEach(b => console.log(`  "${b}"`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
