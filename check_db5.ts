import { prisma } from './src/lib/db';

async function check() {
    const orders = await prisma.order.findMany({
        where: {
            client: {
                name: { contains: 'Rebeca', mode: 'insensitive' }
            }
        },
        select: {
            id: true,
            labOrderNumber: true,
            labStatus: true,
            smartLabProgress: true,
            smartLabDetails: true,
            client: { select: { name: true } }
        }
    });

    console.log("Rebeca orders:", JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
