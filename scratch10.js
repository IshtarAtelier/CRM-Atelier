const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    let now = new Date();
    // What if the Dashboard looks at 'from' and 'to' in a weird way?
    let dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1)
    };

    const currentMonthOrders = await prisma.order.findMany({
        where: {
            createdAt: dateFilter,
            orderType: 'SALE',
            isDeleted: false,
        },
        include: { items: true, payments: true }
    });

    const activeQuotes = await prisma.order.findMany({
        where: {
            orderType: 'QUOTE',
            isDeleted: false,
        }
    });

    const totalSoldMonth = currentMonthOrders.reduce((acc, order) => acc + order.total, 0);
    const totalPaidMonth = currentMonthOrders.reduce((acc, order) => acc + (order.paid || 0), 0);
    const totalQuotesValue = activeQuotes.reduce((acc, order) => acc + (order.total || 0), 0);

    console.log('totalSoldMonth:', totalSoldMonth);
    console.log('totalPaidMonth:', totalPaidMonth);
    console.log('totalPendingBalance:', Math.max(0, totalSoldMonth - totalPaidMonth));
    console.log('totalQuotesValue:', totalQuotesValue);
}

test();
