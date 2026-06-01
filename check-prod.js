const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL
    }
  }
});

async function main() {
  const allSales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false } });
  const noneSales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false, OR: [{ labStatus: 'NONE' }, { labStatus: null }] } });
  const sentSales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false, labStatus: 'SENT' } });
  const inProgressSales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false, labStatus: 'IN_PROGRESS' } });
  const readySales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false, labStatus: 'READY' } });
  const deliveredSales = await prisma.order.count({ where: { orderType: 'SALE', isDeleted: false, labStatus: 'DELIVERED' } });
  
  console.log(`Total Sales: ${allSales}`);
  console.log(`NONE / Null: ${noneSales}`);
  console.log(`SENT (Default filter): ${sentSales}`);
  console.log(`IN_PROGRESS: ${inProgressSales}`);
  console.log(`READY: ${readySales}`);
  console.log(`DELIVERED: ${deliveredSales}`);
}

main().finally(() => prisma.$disconnect());
