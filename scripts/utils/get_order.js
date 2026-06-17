const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const o = await prisma.order.findUnique({
    where: { id: 'cmqicjoyg0002bn6k0479a4ec' }
  });
  console.log("Order type:", o.orderType);
  console.log("Order status:", o.status);
  console.log("Order labStatus:", o.labStatus);
}
main().finally(() => prisma.$disconnect());
