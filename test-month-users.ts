import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const fromDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const orders = await prisma.order.findMany({
        where: {
            createdAt: { gte: fromDate }
        },
        select: {
            userId: true,
            user: { select: { name: true } }
        }
    });
    
    const uniqueUsers = new Set();
    orders.forEach(o => {
        uniqueUsers.add(JSON.stringify({ userId: o.userId, userName: o.user?.name }));
    });
    console.log(Array.from(uniqueUsers));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
