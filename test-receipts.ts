import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { receiptUrl: { not: null } },
    select: { id: true, receiptUrl: true, method: true, amount: true }
  });
  console.log('Payments with receipts:', payments.length);
  payments.forEach((p: any, i: number) => {
    if(i < 5) console.log(`Payment [${p.method} - ${p.amount}]: ${p.receiptUrl?.substring(0, 50)}...`);
  });

  const movements = await (prisma as any).cashMovement.findMany({
    where: { receiptUrl: { not: null } },
    select: { id: true, receiptUrl: true, type: true, amount: true }
  });
  console.log('Movements with receipts:', movements.length);
  movements.forEach((m: any, i: number) => {
    if(i < 5) console.log(`Movement [${m.type} - ${m.amount}]: ${m.receiptUrl?.substring(0, 50)}...`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
