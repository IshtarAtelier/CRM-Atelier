import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- START DB CHECK ---');
  try {
    const counts = await Promise.all([
      prisma.user.count(),
      prisma.order.count(),
      prisma.client.count(),
      prisma.invoice.count()
    ]);
    
    console.log('Counts:', {
      users: counts[0],
      orders: counts[1],
      clients: counts[2],
      invoices: counts[3]
    });

    if (counts[3] > 0) {
      const lastInvoices = await prisma.invoice.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
      });
      console.log('Last 3 Invoices:', JSON.stringify(lastInvoices, null, 2));
    }
    
    const latestOrders = await prisma.order.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: { id: true, total: true, orderType: true, createdAt: true }
    });
    console.log('Latest 2 Orders:', JSON.stringify(latestOrders, null, 2));

  } catch (error) {
    console.error('DB Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
