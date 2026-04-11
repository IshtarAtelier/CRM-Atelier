const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Running orders query...');
        const orders = await prisma.order.findMany({
            where: { isDeleted: false },
            include: {
                client: true,
                user: { select: { name: true } },
                items: { include: { product: true } },
                payments: true,
                invoices: true,
                prescription: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        console.log(`Success! Found ${orders.length} orders.`);
        if (orders.length > 0) {
            console.log('First order sample:', JSON.stringify(orders[0], null, 2).slice(0, 500));
        }
    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
