import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the order CC65Y (the id might contain this code)
  // First, let's find the order for "Melchior Alfonso Elio" around April 11
  const orders = await prisma.order.findMany({
    where: {
      client: {
        name: { contains: 'Melchior', mode: 'insensitive' }
      }
    },
    include: {
      payments: true,
      client: { select: { name: true } }
    }
  });

  console.log('Orders for Melchior:');
  for (const o of orders) {
    console.log(`  Order ${o.id} - Client: ${o.client.name} - Created: ${o.createdAt}`);
    for (const p of o.payments) {
      console.log(`    Payment ${p.id} - Method: ${p.method} - Amount: ${p.amount} - Date: ${p.date}`);
    }
  }

  // Find the specific payment with PAY_WAY_3_YANI
  const targetPayments = orders.flatMap(o => o.payments).filter(p => p.method === 'PAY_WAY_3_YANI');
  
  if (targetPayments.length === 0) {
    console.log('\nNo PAY_WAY_3_YANI payments found for Melchior.');
    return;
  }

  console.log(`\nFound ${targetPayments.length} PAY_WAY_3_YANI payment(s). Updating to PAY_WAY_6_YANI...`);

  for (const p of targetPayments) {
    await prisma.payment.update({
      where: { id: p.id },
      data: { method: 'PAY_WAY_6_YANI' }
    });
    console.log(`  Updated payment ${p.id} from PAY_WAY_3_YANI -> PAY_WAY_6_YANI`);
  }

  console.log('\nDone! Verification:');
  const updated = await prisma.order.findMany({
    where: {
      client: {
        name: { contains: 'Melchior', mode: 'insensitive' }
      }
    },
    include: {
      payments: true,
      client: { select: { name: true } }
    }
  });
  for (const o of updated) {
    for (const p of o.payments) {
      console.log(`  Payment ${p.id} - Method: ${p.method} - Amount: ${p.amount}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
