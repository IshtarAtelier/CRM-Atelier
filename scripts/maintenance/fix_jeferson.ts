import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const orders = await prisma.order.findMany({
        where: {
            labOrderNumber: { contains: '80514517' }
        },
        select: { id: true, labStatus: true, client: { select: { name: true } } }
    });

    console.log("Found in PROD:", orders);

    if (orders.length > 0) {
        await prisma.order.update({
            where: { id: orders[0].id },
            data: { labStatus: 'IN_PROGRESS' }
        });
        console.log("Updated Jeferson to IN_PROGRESS");
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
