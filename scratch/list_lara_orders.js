const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'Lara Esbry', mode: 'insensitive' } },
    include: { orders: true }
  });

  if (!client) {
    console.log('Client not found');
    return;
  }

  console.log('Client Name:', client.name);
  client.orders.forEach(o => {
    console.log(`Order ID: ${o.id}, Status: ${o.status}, LabStatus: ${o.labStatus}, OrderType: ${o.orderType}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
