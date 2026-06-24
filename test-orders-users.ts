import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        select: {
            userId: true,
            user: { select: { name: true } }
        },
        distinct: ['userId']
    });
    console.log(orders);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
