const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    try {
        console.log('Testing Prisma FindMany...');
        const order = await prisma.order.findFirst({
            include: { invoices: true }
        });
        console.log(order ? 'Success' : 'No orders found');
    } catch (e) {
        console.error('ERROR DETAILS:', e.message);
    }
}

run()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
