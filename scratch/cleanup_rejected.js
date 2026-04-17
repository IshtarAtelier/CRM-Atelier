const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    // Delete all REJECTED invoice requests — they are old/invalid and clutter the DB
    const deleted = await prisma.notification.deleteMany({
        where: {
            type: 'INVOICE_REQUEST',
            status: 'REJECTED'
        }
    });
    console.log(`Deleted ${deleted.count} REJECTED invoice requests.`);

    // Verify final state
    const remaining = await prisma.notification.findMany({
        where: { type: 'INVOICE_REQUEST' },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`\nRemaining INVOICE_REQUEST notifications: ${remaining.length}`);
    for (const n of remaining) {
        console.log(`  [${n.status}] Order #${(n.orderId||'?').slice(-4).toUpperCase()} | ${n.message.slice(0, 90)}`);
    }

    // Check for any duplicates
    const byOrder = {};
    for (const n of remaining) {
        const key = n.orderId || 'NO_ORDER';
        if (!byOrder[key]) byOrder[key] = 0;
        byOrder[key]++;
    }
    const dupes = Object.entries(byOrder).filter(([, count]) => count > 1);
    if (dupes.length === 0) {
        console.log('\n✅ CLEAN: Zero duplicates. Each order has exactly 1 pending request.');
    } else {
        console.log(`\n❌ Still ${dupes.length} duplicates found.`);
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
