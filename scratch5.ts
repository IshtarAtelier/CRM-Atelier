import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const laura = await prisma.client.findFirst({
    where: { name: { contains: 'Laura Julieta', mode: 'insensitive' } },
    include: { tasks: true, orders: { include: { payments: true } } }
  });

  if (laura) {
    console.log(`-- Client: ${laura.name} --`);
    console.log(`Tasks:`);
    laura.tasks.forEach(t => console.log(`  - ${t.description} [${t.status}]`));
    console.log(`Orders:`);
    laura.orders.forEach(o => {
      console.log(`  - Order ${o.id}: total ${o.total}, paid ${o.paid}`);
      o.payments.forEach(p => console.log(`     - Payment: ${p.amount} on ${p.date}`));
    });
  } else {
    console.log("Not found.");
  }

}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
