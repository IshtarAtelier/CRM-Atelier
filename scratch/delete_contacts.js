const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const idsToDelete = [
    'cmnuu9eu50000ru7yn3j8420b', // Blanca
    'cmntdu7bn000od87gz01xzglo', // ishtar
    'cmnt7n52h0000d87g7mkx4sgi'  // test
  ];

  console.log('Deleting clients:', idsToDelete);

  const deleted = await prisma.client.deleteMany({
    where: {
      id: { in: idsToDelete }
    }
  });

  console.log('Successfully deleted count:', deleted.count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
