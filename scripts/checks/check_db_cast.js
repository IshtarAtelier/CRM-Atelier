const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    const orders = await prisma.order.findMany({
      take: 10,
      select: { labPdOd: true, labPdOi: true }
    });
    console.log(orders);
  } catch(e) {
    console.log("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
