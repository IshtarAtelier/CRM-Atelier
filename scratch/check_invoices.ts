
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const lastInvoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        order: {
          select: {
            id: true,
            total: true,
            client: { select: { name: true } }
          }
        }
      }
    });

    console.log('Last 10 Invoices:');
    console.log(JSON.stringify(lastInvoices, null, 2));

    const counts = await prisma.invoice.groupBy({
      by: ['billingAccount', 'status'],
      _count: { _all: true }
    });
    console.log('\nInvoice counts by account and status:');
    console.log(JSON.stringify(counts, null, 2));

  } catch (error) {
    console.error('Error fetching invoices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
