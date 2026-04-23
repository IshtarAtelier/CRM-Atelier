const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const tasks = await prisma.clientTask.findMany({
        where: { status: 'PENDING' }
    });
    console.log('Pending Tasks:', tasks.length);

    const saldos = await prisma.order.findMany({
        where: { orderType: 'SALE' },
        select: { id: true, total: true, paid: true, clientId: true }
    });
    let c = 0;
    for (let o of saldos) {
        if (o.total > (o.paid || 0)) {
            c++;
        }
    }
    console.log('Sales with missing payments:', c);
}
test();
