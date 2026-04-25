const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkSales() {
  try {
    const lensItems = await prisma.orderItem.findMany({
      where: {
        order: { orderType: 'SALE' },
        product: { category: 'LENS' }
      },
      include: {
        order: {
          include: { client: true }
        },
        product: true
      }
    });

    const deletedLensItems = await prisma.orderItem.findMany({
      where: {
        order: { orderType: 'SALE', isDeleted: true },
        product: { category: 'LENS' }
      },
      include: {
        order: {
          include: { client: true }
        },
        product: true
      }
    });

    const report = {
        totalItemsSold: lensItems.length,
        itemsInDeletedOrders: deletedLensItems.length,
    };

    console.log(`Report:`, report);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
checkSales();
