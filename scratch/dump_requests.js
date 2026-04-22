const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const notifications = await prisma.notification.findMany({
        where: {
            type: 'INVOICE_REQUEST',
            status: 'PENDING'
        },
        orderBy: {
            createdAt: 'asc' // Older ones first
        }
    });

    console.log(`Found ${notifications.length} pending invoice requests...`);
    for (const n of notifications) {
        console.log(`ID: ${n.id}`);
        console.log(`OrderId: ${n.orderId}`);
        console.log(`RequestedBy: ${n.requestedBy}`);
        console.log(`Message: ${n.message}`);
        console.log(`Date: ${n.createdAt}`);
        console.log("-------------------");
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
