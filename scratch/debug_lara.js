const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const order = await prisma.order.findFirst({
    where: { id: { endsWith: 'MC59' } },
    include: { client: { include: { tasks: true } } }
  });

  console.log('Order:', JSON.stringify(order, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
