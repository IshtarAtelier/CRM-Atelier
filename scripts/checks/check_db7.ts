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
            items: {
                select: {
                    product: { select: { laboratory: true, category: true, name: true } },
                    productNameSnapshot: true,
                }
            }
        }
    });

    console.log("Rebeca details:", JSON.stringify(orders, null, 2));
}

check().catch(console.error).finally(() => process.exit(0));
