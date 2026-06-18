const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findFirst({
    where: { id: { endsWith: "a4ec" } }
  });
  console.log(order.labFrameShape);
  console.log(order.labFrameDetails);
}
main().catch(console.error).finally(() => prisma.$disconnect());
