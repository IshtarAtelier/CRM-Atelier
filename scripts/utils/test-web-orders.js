const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        where: {
            OR: [
                { orderType: 'WEB' },
                { status: { startsWith: 'WEB' } }
            ]
        },
        include: { client: true }
    });
    console.log("Web Orders:", orders.length);
    console.log(orders.map(o => ({ id: o.id, orderType: o.orderType, status: o.status })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
