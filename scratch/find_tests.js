const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: 'Test', mode: 'insensitive' } },
        { name: { contains: 'Jetski', mode: 'insensitive' } }
      ]
    },
    include: {
      orders: true,
      prescriptions: true
    }
  });
  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
