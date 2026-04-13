const { PrismaClient } = require('@prisma/client');

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_URL,
    },
  },
});

async function findTestingMovement() {
  console.log('Searching for testing movement in production (Railway)...');
  try {
    const movement = await prisma.cashMovement.findFirst({
      where: {
        amount: 250000,
        reason: {
          contains: 'Inti Balderrama Artifoni'
        }
      }
    });

    if (movement) {
      console.log('✅ Found movement in production:', JSON.stringify(movement, null, 2));
    } else {
      console.log('❌ Movement not found in production.');
    }
  } catch (err) {
    console.error('Error connecting to production:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

findTestingMovement();
