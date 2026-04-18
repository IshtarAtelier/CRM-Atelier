const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const orders = await prisma.order.findMany({
        where: { id: { in: ['cmnujin1t0013vjc8lsxokfw', 'cmnr2856x001tvjz4d4qh'] } },
        include: { payments: true }
    });
    console.log(JSON.stringify(orders.flatMap(o => o.payments.map(p => ({
        id: p.id,
        orderId: p.orderId,
        length: p.receiptUrl ? p.receiptUrl.length : 0,
        prefix: p.receiptUrl ? p.receiptUrl.substring(0, 50) : null
    }))), null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
