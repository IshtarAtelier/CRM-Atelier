import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== TASKS SUMMARY ===");
  const tasksMatias = await prisma.clientTask.findMany({
    where: {
      createdBy: { contains: 'matias', mode: 'insensitive' }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { client: true }
  });
  console.log("Recent 10 tasks created by / assigned to matias:");
  console.table(tasksMatias.map(t => ({ id: t.id, desc: t.description, status: t.status, dueDate: t.dueDate, client: t.client?.name })));

  const allPending = await prisma.clientTask.findMany({
    where: { status: 'PENDING' },
    take: 5
  });
  console.log(`\nTotal pending tasks in system: ${await prisma.clientTask.count({ where: { status: 'PENDING' } })}`);
  if (allPending.length > 0) {
      console.log("Some pending tasks:", allPending.map(t => t.description));
  }

  console.log("\n=== RECENT ORDERS SUMMARY ===");
  const recentOrders = await prisma.order.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { client: true }
  });
  
  console.table(recentOrders.map(o => ({
    id: o.id,
    client: o.client?.name,
    total: o.total,
    paid: o.paid,
    status: o.status,
    balance: o.total - o.paid,
    updatedAt: o.updatedAt
  })));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
