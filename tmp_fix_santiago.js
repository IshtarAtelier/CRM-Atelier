const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    // Find Santiago's order
    const order = await p.order.findFirst({
        where: {
            client: { name: 'Santiago' },
            orderType: 'SALE',
            total: 80000
        }
    });

    if (!order) {
        console.log('ERROR: Order not found');
        return;
    }

    // Add payment and update order
    await p.payment.create({
        data: {
            orderId: order.id,
            amount: 80000,
            method: 'Efectivo',
            date: new Date('2026-03-02'),
        }
    });

    await p.order.update({
        where: { id: order.id },
        data: { paid: 80000, status: 'PAID' }
    });

    console.log('OK: Santiago $80.000 Efectivo -> PAID');
}

main().finally(() => p.$disconnect());
