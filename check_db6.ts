import { prisma } from './src/lib/db';

async function check() {
    const orders = await prisma.order.findMany({
        where: {
            labOrderNumber: "576357 - 576361"
        },
        select: {
            client: { select: { name: true } }
        }
    });

    console.log("Optovision order:", JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
