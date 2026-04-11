const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const p = await prisma.payment.findMany({
        include: { order: { include: { client: true } } }
    });
    
    console.log(`Total payments: ${p.length}`);
    for (const payment of p) {
        if (!payment.order) {
            console.log(`Payment ${payment.id} has NO ORDER`);
            continue;
        }
        
        const isClientMelchior = payment.order.client && payment.order.client.name.includes('Melchior');
        const isClientTest = payment.order.client && payment.order.client.name.includes('test');
        
        if (payment.order.isDeleted || isClientMelchior || isClientTest) {
            console.log(`- ID: ${payment.id} | Amount: ${payment.amount} | Client: ${payment.order.client?.name} | isDeleted: ${payment.order.isDeleted}`);
        }
    }
}
check().catch(console.error).finally(() => prisma.$disconnect());
