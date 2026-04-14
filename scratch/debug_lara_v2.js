const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'Lara Esbry', mode: 'insensitive' } },
    include: { tasks: true, orders: true }
  });

  console.log('Client:', JSON.stringify(client, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
