import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const labs = await prisma.product.findMany({
    select: { laboratory: true },
    where: {
      laboratory: {
        contains: 'opto',
        mode: 'insensitive'
      }
    }
  });
  
  const uniqueLabs = [...new Set(labs.map(l => l.laboratory))];
  console.log('Unique laboratories found in DB matching "opto":');
  uniqueLabs.forEach(l => {
    console.log(`- "${l}" (length: ${l?.length})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
