import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const allProducts = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: '2x1', mode: 'insensitive' } },
                { model: { contains: '2x1', mode: 'insensitive' } },
                { type: { contains: '2x1', mode: 'insensitive' } }
            ]
        }
    });
    
    console.log(`Found ${allProducts.length} products with '2x1' in the text.`);
    allProducts.forEach(p => {
        console.log(`- ID: ${p.id} | Name: ${p.name} | Type: ${p.type} | is2x1: ${p.is2x1}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
