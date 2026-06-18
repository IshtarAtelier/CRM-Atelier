const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: { id: 'cmqidm693000gqq6q5e3l7u12' } // No, I don't know the ID. I'll search by client.
  });
  
  const client = await prisma.client.findFirst({
    where: { name: 'Ishtar Prueba' },
    include: { orders: { include: { prescription: true } } }
  });
  console.log("Client orders:", JSON.stringify(client.orders, null, 2));
}

main().finally(() => prisma.$disconnect());
