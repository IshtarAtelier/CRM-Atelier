import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const lensProducts = await prisma.product.findMany({
        where: { category: 'LENS' }
    });
    console.log(`Found ${lensProducts.length} products with category LENS.`);
    
    // show distinct types
    const types = new Set(lensProducts.map(p => p.type));
    console.log(`Unique types for LENS:`, Array.from(types));
}

main().catch(console.error).finally(() => prisma.$disconnect());
