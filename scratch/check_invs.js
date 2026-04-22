const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const oId = 'cmnqnt0y9001npp7tekyhts4j';
    const invs = await prisma.invoice.findMany({
        where: { orderId: oId }
    });
    console.log(`Invoices for ${oId}: ${invs.length}`);
    for (const inv of invs) {
        console.log(`- ${inv.status} | Total: ${inv.totalAmount}`);
    }

    const notifs = await prisma.notification.findMany({
        where: { message: { contains: 'Sergio Monteros' } }
    });
    console.log(`Notifications for Sergio Monteros: ${notifs.length}`);
    for (const n of notifs) {
        console.log(`- [${n.status}] ${n.requestedBy}: ${n.message} (Date: ${n.createdAt})`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
