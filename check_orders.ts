import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        where: {
            OR: [
                { id: { endsWith: 'YIOS', mode: 'insensitive' } },
                { id: { endsWith: 'XQQC', mode: 'insensitive' } }
            ]
        },
        include: {
            payments: true,
            items: {
                include: { product: true }
            }
        }
    });
    console.log(JSON.stringify(orders, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
