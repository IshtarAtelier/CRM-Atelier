import { prisma } from './src/lib/db';

async function check() {
    const orders = await prisma.order.findMany({
        where: {
            labOrderNumber: { not: null },
            isDeleted: false,
            orderType: 'SALE',
            labStatus: { in: ['SENT', 'IN_PROGRESS'] },
        },
        select: {
            id: true,
            labOrderNumber: true,
            items: {
                select: {
                    product: { select: { laboratory: true, category: true } }
                }
            }
        }
    });

    console.log("Orders pending sync:", JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
