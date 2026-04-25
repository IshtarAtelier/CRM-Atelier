import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: { name: { contains: 'COMFORT MAX - STYLIS 1.67', mode: 'insensitive' } }
    });
    console.log(`Found ${products.length} products`);
    products.forEach(p => console.log(`- ID: ${p.id} | Name: ${p.name} | is2x1: ${p.is2x1}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
