const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const all = await prisma.notification.findMany({
        where: { type: 'INVOICE_REQUEST' },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Total INVOICE_REQUEST notifications: ${all.length}\n`);

    // Group by orderId
    const byOrder = {};
    for (const n of all) {
        const key = n.orderId || 'NO_ORDER';
        if (!byOrder[key]) byOrder[key] = [];
        byOrder[key].push(n);
    }

    let dupeCount = 0;
    for (const [orderId, notifs] of Object.entries(byOrder)) {
        if (notifs.length > 1) {
            console.log(`\n⚠️  ORDER ${orderId.slice(-4).toUpperCase()} has ${notifs.length} requests:`);
            for (const n of notifs) {
                console.log(`   [${n.status}] ${n.message} (by: ${n.requestedBy}, created: ${n.createdAt.toISOString().slice(0,16)})`);
            }
            dupeCount++;
        }
    }

    if (dupeCount === 0) {
        console.log('✅ No duplicates found. All requests are unique per order.');
    } else {
        console.log(`\n❌ Found ${dupeCount} orders with multiple requests.`);
    }

    // Also show clean summary
    console.log('\n--- FULL LIST ---');
    for (const n of all) {
        const tag = n.status === 'PENDING' ? '🟡' : n.status === 'APPROVED' ? '🟢' : '⚪';
        console.log(`${tag} [${n.status}] Order #${(n.orderId||'?').slice(-4).toUpperCase()} | ${n.message.slice(0, 80)}...`);
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
