const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: {
      name: { contains: 'Juan Mario Allasino', mode: 'insensitive' }
    },
    include: {
      orders: {
        where: { isDeleted: false }
      }
    }
  });
  console.log(JSON.stringify(client, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
