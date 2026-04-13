const { PrismaClient } = require('@prisma/client');

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_URL,
    },
  },
});

async function deleteRecord() {
  const ID = 'cmnt7u6cj000hd87gf13cwcyj';
  console.log(`Attempting to delete record with ID: ${ID} from production...`);
  
  try {
    const deleted = await prisma.cashMovement.delete({
      where: { id: ID }
    });
    console.log('✅ Successfully deleted record:', JSON.stringify(deleted, null, 2));
  } catch (err) {
    if (err.code === 'P2025') {
      console.log('❌ Record not found (it might have been deleted already).');
    } else {
      console.error('Error deleting record:', err.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

deleteRecord();
