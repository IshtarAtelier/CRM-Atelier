import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    const kodak = await prisma.product.findMany({
        where: { brand: 'Kodak' }
    });
    
    console.log(`Encontrados ${kodak.length} productos Kodak`);
    for (const p of kodak.slice(0, 10)) {
        console.log(`[${p.id}] Cat: ${p.category} | Type: ${p.type} | Name: ${p.name}`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
