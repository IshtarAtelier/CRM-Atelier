import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    const products = await prisma.product.findMany({
        where: { brand: { contains: 'Smart', mode: 'insensitive' } }
    });

    for (const p of products) {
        console.log(`[${p.id}] Cat: ${p.category} | Type: ${p.type} | Name: ${p.name}`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
