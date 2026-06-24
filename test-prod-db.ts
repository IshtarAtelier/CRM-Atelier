import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
});

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true
        }
    });
    console.log("PROD USERS:", users);
    
    // Also check what userIds have orders this month
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
    console.log("PROD MONTH USERS IN ORDERS:", Array.from(uniqueUsers));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
