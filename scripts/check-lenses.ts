import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lensesWithoutIndex = await prisma.product.findMany({
    where: {
      category: 'LENS',
      OR: [
        { lensIndex: null },
        { lensIndex: '' }
      ]
    },
    select: {
      id: true,
      name: true,
      brand: true,
      model: true,
      type: true
    }
  });

  const totalLenses = await prisma.product.count({
    where: {
      category: 'LENS'
    }
  });

  console.log(`Total lenses: ${totalLenses}`);
  console.log(`Lenses without index: ${lensesWithoutIndex.length}`);
  if (lensesWithoutIndex.length > 0) {
    console.log('Details:');
    lensesWithoutIndex.forEach(l => {
      console.log(`- [${l.id}] ${l.name || 'No Name'} (${l.brand || 'No Brand'} ${l.model || ''}) - Type: ${l.type}`);
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
