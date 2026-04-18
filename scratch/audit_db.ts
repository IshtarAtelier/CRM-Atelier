import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- AUDITORÍA DE FACTURAS EN DB ---');
  const invoiceCount = await prisma.invoice.count();
  console.log(`Total facturas encontradas: ${invoiceCount}`);

  if (invoiceCount > 0) {
    const invoices = await prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        voucherNumber: true,
        pointOfSale: true,
        cae: true,
        totalAmount: true,
        billingAccount: true,
        createdAt: true,
        status: true
      }
    });
    console.table(invoices);
  } else {
    console.log('No hay facturas en la base de datos.');
  }
}

main()
  .catch((e) => {
    console.error('Error conectando a la DB:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
