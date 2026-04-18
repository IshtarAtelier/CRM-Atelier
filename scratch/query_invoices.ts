import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const invoices = await prisma.invoice.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      voucherNumber: true,
      voucherType: true,
      pointOfSale: true,
      cae: true,
      totalAmount: true,
      billingAccount: true,
      createdAt: true
    }
  });

  console.log(JSON.stringify(invoices, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
