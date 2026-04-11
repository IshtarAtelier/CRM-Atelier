import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({
    where: { 
        isDeleted: false,
        total: { gt: 0 }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, total: true, paid: true }
  });
  console.log('TEST_ORDER_ID:', order?.id);
  console.log('TOTAL:', order?.total);
  console.log('PAID:', order?.paid);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
