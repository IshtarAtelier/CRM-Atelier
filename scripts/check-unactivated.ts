import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const allProducts = await prisma.product.findMany();
    
    const unactivated = allProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        return name.includes('2x1') && !p.is2x1;
    });
    
    console.log(`Found ${unactivated.length} products with '2x1' in name but is2x1 is FALSE.`);
    unactivated.forEach(p => console.log(`- ID: ${p.id} | Name: ${p.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
