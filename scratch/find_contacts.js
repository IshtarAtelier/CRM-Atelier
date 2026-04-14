const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: 'Blanca', mode: 'insensitive' } },
        { name: { contains: 'ishtar', mode: 'insensitive' } },
        { name: { contains: 'test', mode: 'insensitive' } },
        { phone: { contains: '3515934276' } },
        { phone: { contains: '3541215971' } },
        { phone: { contains: '3541' } }
      ]
    }
  });
  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
