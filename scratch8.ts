import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { client: { select: { name: true } }, orderType: true, total: true, paid: true }
  });
  console.log("Recent 10 orders:");
  console.table(orders.map(o => ({ client: o.client?.name, type: o.orderType, total: o.total, paid: o.paid })));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
