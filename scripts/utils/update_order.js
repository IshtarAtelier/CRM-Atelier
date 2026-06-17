const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    where: {
      client: {
        name: {
          contains: 'Test'
        }
      }
    },
    include: { client: true }
  });
  console.log("Found orders:", orders.map(o => ({ id: o.id, status: o.labStatus, client: o.client.name })));
  
  if (orders.length > 0) {
    const target = orders.find(o => o.client.name.includes('Test Forma Armazon')) || orders[0];
    await prisma.order.update({
      where: { id: target.id },
      data: { labStatus: 'PENDING', status: 'PENDING' }
    });
    console.log("Updated order", target.id, "to PENDING");
  }
}
main().finally(() => prisma.$disconnect());
