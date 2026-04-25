import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const p = await prisma.product.findFirst({
        where: { name: { contains: 'SMART FREE - Organico Blue Ligth con Ar essential, 2x1', mode: 'insensitive' } }
    });
    console.log("Product:", p);
}

main().catch(console.error).finally(() => prisma.$disconnect());
