import { PrismaClient } from '@prisma/client';

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_URL,
    },
  },
});

async function findAndDeleteTestingMovement() {
  console.log('Searching for testing movement in production...');
  const movement = await prisma.cashMovement.findFirst({
    where: {
      amount: 250000,
      reason: {
        contains: 'Inti Balderrama Artifoni'
      }
    }
  });

  if (movement) {
    console.log('Found movement:', JSON.stringify(movement, null, 2));
    const deleted = await prisma.cashMovement.delete({
      where: { id: movement.id }
    });
    console.log('✅ Deleted movement:', deleted.id);
  } else {
    console.log('❌ Movement not found.');
  }
}

findAndDeleteTestingMovement()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
