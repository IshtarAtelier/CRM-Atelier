const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        where: {
            id: {
                endsWith: 'ts4j',
                mode: 'insensitive'
            }
        }
    });

    console.log(`Found ${orders.length} orders ending in ts4j...`);
    for (const o of orders) {
        console.log(`ID: ${o.id}`);
        
        const notifs = await prisma.notification.findMany({
            where: { orderId: o.id }
        });
        console.log(`  Has ${notifs.length} notifications:`);
        for (const n of notifs) {
            console.log(`    - [${n.status}] ${n.requestedBy}: ${n.message}`);
        }
    }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
