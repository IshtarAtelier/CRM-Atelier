import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const withoutIndex = await prisma.product.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { category: 'Cristal' },
                        { type: { startsWith: 'Cristal' } }
                    ]
                },
                {
                    OR: [
                        { lensIndex: null },
                        { lensIndex: '' }
                    ]
                }
            ]
        },
        select: { id: true, name: true, brand: true, laboratory: true }
    });
    
    console.log(JSON.stringify(withoutIndex, null, 2));
    
    const totalCrystals = await prisma.product.count({
        where: {
            OR: [
                { category: 'Cristal' },
                { type: { startsWith: 'Cristal' } }
            ]
        }
    });
    console.log(`\nTotal crystals: ${totalCrystals}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
