const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const notifications = await prisma.notification.findMany({
        where: {
            orderId: 'cmnqnt0y9001npp7tekyhts4j',
            type: 'INVOICE_REQUEST'
        }
    });

    for (const n of notifications) {
        console.log(`[${n.status}] ${n.id} | ${n.message}`);
    }
}

main().finally(() => prisma.$disconnect());
