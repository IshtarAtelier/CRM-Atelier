import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const payments = await prisma.payment.findMany({
    where: { receiptUrl: { not: null } },
    select: { id: true, receiptUrl: true }
  });
  payments.forEach((p: any) => console.log('Payment', p.id, 'receipt length:', p.receiptUrl?.length));
}

main().catch(console.error).finally(() => prisma.$disconnect());
