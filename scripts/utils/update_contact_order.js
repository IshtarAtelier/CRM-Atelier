const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.order.findMany({
    where: { clientId: 'cmqiagi720000xz5qt34r0edv' }
  });
  console.log("Orders for contact:", orders.map(o => o.id));
  if (orders.length > 0) {
    await prisma.order.updateMany({
      where: { clientId: 'cmqiagi720000xz5qt34r0edv' },
      data: { labStatus: 'IN_PROGRESS' }
    });
    console.log("Updated to IN_PROGRESS (Procesado)");
  }
}
main().finally(() => prisma.$disconnect());
