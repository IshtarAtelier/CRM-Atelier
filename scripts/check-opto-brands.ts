import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.product.findMany({
    select: { brand: true },
    where: {
      brand: {
        contains: 'opto',
        mode: 'insensitive'
      }
    }
  });
  
  const uniqueBrands = [...new Set(brands.map(b => b.brand))];
  console.log('Unique brands found in DB matching "opto":');
  uniqueBrands.forEach(b => {
    console.log(`- "${b}" (length: ${b?.length})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
