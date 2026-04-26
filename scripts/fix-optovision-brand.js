// Fix duplicate Optovision brand entries in production
// This script finds all products where brand is similar to "Optovision" with different casings
// and normalizes them to a single canonical form: "Optovision"

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Buscando marcas duplicadas tipo "Optovision"...\n');

    // First, find all distinct brands
    const allProducts = await prisma.product.findMany({
        select: { id: true, brand: true, name: true },
        where: {
            brand: { not: null }
        }
    });

    // Find all unique brand values (case-sensitive)
    const brandMap = new Map();
    for (const p of allProducts) {
        const key = (p.brand || '').toLowerCase().trim();
        if (!brandMap.has(key)) brandMap.set(key, new Set());
        brandMap.get(key).add(p.brand);
    }

    // Find brands with multiple casings
    console.log('📋 Marcas con variantes de casing:');
    for (const [key, variants] of brandMap) {
        if (variants.size > 1) {
            console.log(`  "${key}" → ${[...variants].map(v => `"${v}"`).join(', ')} (${allProducts.filter(p => (p.brand || '').toLowerCase().trim() === key).length} productos)`);
        }
    }

    // Now specifically look for Optovision variants
    const optoVariants = allProducts.filter(p => 
        p.brand && p.brand.toLowerCase().trim().includes('optovision') ||
        p.brand && p.brand.toLowerCase().trim().includes('opto vision') ||
        p.brand && p.brand.toLowerCase().trim() === 'opto'
    );

    const optoDistinct = [...new Set(optoVariants.map(p => p.brand))];
    console.log(`\n🔬 Variantes de Optovision encontradas: ${optoDistinct.map(v => `"${v}"`).join(', ')}`);
    console.log(`   Total productos afectados: ${optoVariants.length}`);

    if (optoVariants.length === 0) {
        console.log('\n✅ No se encontraron duplicados de Optovision.');
        return;
    }

    // Normalize all to "Optovision" (Title Case)
    const CANONICAL_BRAND = 'Optovision';
    
    console.log(`\n🔧 Normalizando todas las variantes a "${CANONICAL_BRAND}"...`);
    
    const result = await prisma.product.updateMany({
        where: {
            brand: { in: optoDistinct.filter(v => v !== CANONICAL_BRAND) }
        },
        data: {
            brand: CANONICAL_BRAND
        }
    });

    console.log(`✅ ${result.count} productos actualizados a brand="${CANONICAL_BRAND}"`);

    // Verify
    const verify = await prisma.product.findMany({
        where: { brand: { contains: 'optovision', mode: 'insensitive' } },
        select: { brand: true },
        distinct: ['brand']
    });
    console.log(`\n📊 Verificación — Marcas restantes con "optovision": ${verify.map(v => `"${v.brand}"`).join(', ')}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
