const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { client: true }
  });
  console.log(JSON.stringify(orders.map(o => ({ 
      id: o.id, 
      clientName: o.client?.name, 
      labStatus: o.labStatus, 
      status: o.status, 
      updatedAt: o.updatedAt,
      type: o.orderType
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
