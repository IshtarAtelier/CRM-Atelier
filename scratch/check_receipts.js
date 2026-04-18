const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const orders = await prisma.order.findMany({
        where: { payments: { some: { receiptUrl: { not: null } } } },
        include: { payments: true },
        take: 3,
        orderBy: { createdAt: 'desc' }
    });

    for (const o of orders) {
        for (const p of o.payments) {
            if (p.receiptUrl) {
                console.log(`Payment ${p.id} receipt: ${p.receiptUrl.substring(0, 50)}...`);
            }
        }
    }
}
run().finally(() => prisma.$disconnect());
