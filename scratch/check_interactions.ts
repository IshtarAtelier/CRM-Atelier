
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const invoiceInteractions = await prisma.interaction.findMany({
      where: { type: 'INVOICE' },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('Last 10 Invoice Interactions:');
    console.log(JSON.stringify(invoiceInteractions, null, 2));

  } catch (error) {
    console.error('Error fetching interactions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
