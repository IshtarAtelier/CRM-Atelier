import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const compTasks = await prisma.clientTask.findMany({
    where: {
      status: 'COMPLETED'
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { client: true }
  });
  console.log("=== RECENTLY COMPLETED TASKS ===");
  console.table(compTasks.map(t => ({ id: t.id, desc: t.description, status: t.status, createdBy: t.createdBy, client: t.client?.name, updatedAt: t.updatedAt })));

  const recentPayments = await prisma.payment.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    include: { order: { include: { client: true } } }
  });

  console.log("\n=== RECENT PAYMENTS ===");
  console.table(recentPayments.map(p => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    date: p.date,
    client: p.order.client?.name,
    orderId: p.orderId
  })));

}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
