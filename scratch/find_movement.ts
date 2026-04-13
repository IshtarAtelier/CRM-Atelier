import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findTestingMovement() {
  const movements = await prisma.cashMovement.findMany({
    where: {
      amount: 250000,
      category: 'APORTE_EFECTIVO',
      reason: {
        contains: 'Inti Balderrama Artifoni'
      }
    }
  });

  console.log('Found movements:', JSON.stringify(movements, null, 2));
}

findTestingMovement()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
