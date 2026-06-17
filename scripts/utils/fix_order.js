const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.order.update({
    where: { id: 'cmqicjoyg0002bn6k0479a4ec' },
    data: { status: 'CONFIRMED' }
  });
  console.log("Fixed status to CONFIRMED");
}
main().finally(() => prisma.$disconnect());
