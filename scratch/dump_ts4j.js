const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const notifications = await prisma.notification.findMany({
        where: {
            orderId: 'cmnqnt0y9001npp7tekyhts4j', // Sergio Monteros TS4J
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    console.log(`Found ${notifications.length} notifications...`);
    for (const n of notifications) {
        console.log(`ID: ${n.id} | Status: ${n.status} | Type: ${n.type}`);
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
