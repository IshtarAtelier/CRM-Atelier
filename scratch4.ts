import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const recentClients = await prisma.client.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: { tasks: true, orders: { include: { payments: true } } }
  });

  console.log("=== MOST RECENTLY UPDATED CLIENTS ===");
  recentClients.forEach(c => {
    console.log(`-- Client: ${c.name} (${c.id}) -- Updated: ${c.updatedAt}`);
    console.log(`   Tasks: ${c.tasks.length}`);
    c.tasks.forEach(t => console.log(`     - ${t.description} [${t.status}]`));
    console.log(`   Orders: ${c.orders.length}`);
    c.orders.forEach(o => {
      console.log(`     - Order total: ${o.total}, paid: ${o.paid}, status: ${o.status}`);
    });
  });

}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
