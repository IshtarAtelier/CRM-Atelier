const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting cleanup...');
    
    // 1. Delete all payments where order is deleted
    const orphans = await prisma.payment.findMany({
        where: { order: { isDeleted: true } }
    });
    console.log('Orphaned payments:', orphans.length);
    if (orphans.length > 0) {
        const res = await prisma.payment.deleteMany({
            where: { order: { isDeleted: true } }
        });
        console.log('Deleted orphaned:', res.count);
    }
    
    // 2. Delete test payments
    const testPayments = await prisma.payment.findMany({
        where: { order: { client: { name: { contains: 'test' } } } }
    });
    console.log('Found test payments:', testPayments.length);
    if (testPayments.length > 0) {
        const testRes = await prisma.payment.deleteMany({
            where: { id: { in: testPayments.map((p) => p.id) } }
        });
        console.log('Deleted tests:', testRes.count);
    }
    
    // 3. Cleanup Melchior payments (leave 1 if exists)
    const melchiorOrders = await prisma.order.findMany({
        where: { client: { name: { contains: 'Melchior' } } },
        include: { payments: true }
    });
    
    let keptOne = false;
    for (const o of melchiorOrders) {
        for (const p of o.payments) {
            if (!keptOne && o.isDeleted === false) {
                keptOne = true;
                console.log('Keeping Melchior payment:', p.id);
                continue;
            }
            console.log('Deleting duplicate/old Melchior payment:', p.id);
            await prisma.payment.delete({ where: { id: p.id } });
        }
    }
    console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
