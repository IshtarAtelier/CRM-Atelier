import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const invoiceCount = await prisma.invoice.count();
  const orderCount = await prisma.order.count();
  
  console.log(`Invoices in DB: ${invoiceCount}`);
  console.log(`Orders in DB: ${orderCount}`);

  if (invoiceCount > 0) {
    const invoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Recent Invoices:', JSON.stringify(invoices, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
