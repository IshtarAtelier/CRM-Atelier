const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function checkMethods() {
    try {
        const methods = await prisma.payment.groupBy({
            by: ['method'],
            _count: { _all: true },
            _sum: { amount: true }
        });
        console.log('--- Payment Methods Breakdown ---');
        console.log(JSON.stringify(methods, null, 2));

        const movementTypes = await prisma.cashMovement.groupBy({
            by: ['type'],
            _count: { _all: true },
            _sum: { amount: true }
        });
        console.log('\n--- Cash Movement Types Breakdown ---');
        console.log(JSON.stringify(movementTypes, null, 2));

    } catch (e) {
        console.error(e.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkMethods();
