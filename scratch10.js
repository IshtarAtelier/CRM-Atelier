const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const now = new Date();
    const dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    
    const currentMonthOrders = await prisma.order.findMany({
        where: { createdAt: dateFilter, orderType: 'SALE', isDeleted: false },
        select: { id: true, total: true, paid: true, client: { select: { name: true } } }
    });
    
    let dbTotal = 0;
    let dbPaid = 0;
    for (const o of currentMonthOrders) {
        dbTotal += o.total;
        dbPaid += (o.paid || 0);
        console.log(`Order ${o.id} - ${o.client.name}: Total ${o.total}, Paid ${o.paid}`);
    }
    
    console.log(`Overall: Total Sold = ${dbTotal}, Total Paid = ${dbPaid}`);
    console.log(`Pending Month: ${Math.max(0, dbTotal - dbPaid)}`);
}
test();
