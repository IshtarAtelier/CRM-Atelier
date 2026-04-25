import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    const cristales = await prisma.product.findMany({
        where: {
            OR: [
                { category: 'Cristal' },
                { category: 'LENS' }
            ]
        }
    });

    let badCount = 0;
    for (const p of cristales) {
        if (!p.type || p.type === '-' || p.type.trim() === '' || p.type === 'Cristal') {
            badCount++;
            console.log(`[${p.id}] ${p.brand} ${p.name} -> Cat: ${p.category}, Type: ${p.type}`);
        }
    }
    console.log(`Total cristales con tipo malo: ${badCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
