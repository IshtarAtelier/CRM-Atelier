const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    
    const allSales = await prisma.order.findMany({
        where: { orderType: 'SALE' },
        select: { id: true, total: true, paid: true, isDeleted: true, client: { select: { name: true } } }
    });
    
    console.log('All sales including deleted:');
    for (const o of allSales) {
        console.log(`Order ${o.id} - ${o.client.name}: Total ${o.total}, Paid ${o.paid}, Deleted: ${o.isDeleted}`);
    }
}
test();
