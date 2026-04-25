import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    const products = await prisma.product.findMany({
        where: { name: { contains: 'SMART FREE' } }
    });

    for (const p of products) {
        console.log(`ID: ${p.id} | Name: ${p.name} | Type: ${p.type}`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
