import { prisma } from './src/lib/db';

async function check() {
    const orders = await prisma.order.findMany({
        where: {
            smartLabLastSync: { not: null }
        },
        select: {
            labOrderNumber: true,
            smartLabLastSync: true,
            smartLabProgress: true,
            labStatus: true
        },
        orderBy: {
            smartLabLastSync: 'desc'
        },
        take: 5
    });

    console.log("Recent syncs:", JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
