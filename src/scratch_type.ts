import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { category: 'Cristal' },
                { type: { startsWith: 'Cristal' } }
            ]
        }
    });

    let emptyTypeCount = 0;
    for (const p of products) {
        if (!p.type || p.type.trim() === '' || p.type === 'Cristal') {
            emptyTypeCount++;
            console.log(`- ${p.brand || ''} ${p.name}`);
        }
    }
    console.log(`\nTotal cristales sin subtipo: ${emptyTypeCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
