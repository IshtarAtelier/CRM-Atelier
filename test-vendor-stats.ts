import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        select: {
            userId: true,
            user: { select: { name: true } },
            payments: { select: { amount: true } }
        }
    });
    
    const vendorStats: any = {};
    for (const order of orders) {
        const orderPaidReal = order.payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const vId = order.userId;
        const vName = order.user?.name || 'Sin asignar';
        // if vId is null, what happens? vendorStats['null'] or vendorStats[null]
        const key = vId === null ? 'null' : vId;
        if (!vendorStats[key]) vendorStats[key] = { name: vName, revenue: 0, orders: 0 };
        vendorStats[key].revenue += orderPaidReal;
        vendorStats[key].orders += 1;
    }
    
    console.log(vendorStats);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
