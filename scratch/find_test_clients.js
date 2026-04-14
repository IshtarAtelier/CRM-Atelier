import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      OR: [
        { name: { contains: 'ishtar', mode: 'insensitive' } },
        { name: { contains: 'test', mode: 'insensitive' } },
        { phone: '3541' },
        { phone: '3541215871' }
      ]
    }
  });

  console.log('Found clients:', JSON.stringify(clients, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
