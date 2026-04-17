const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const all = await prisma.notification.findMany({
        where: { type: 'INVOICE_REQUEST', status: 'PENDING' },
        orderBy: { createdAt: 'desc' }
    });

    const byOrder = {};
    for (const n of all) {
        if (!byOrder[n.orderId]) byOrder[n.orderId] = [];
        byOrder[n.orderId].push(n);
    }

    let deletedCount = 0;

    for (const [orderId, notifs] of Object.entries(byOrder)) {
        if (notifs.length > 1) {
            console.log(`Order ${orderId} has ${notifs.length} notifications.`);
            const manual = notifs.filter(n => n.requestedBy !== 'SISTEMA (Auto)' && !n.requestedBy.includes('Retroactivo'));
            const auto = notifs.filter(n => n.requestedBy === 'SISTEMA (Auto)' || n.requestedBy.includes('Retroactivo'));

            // If there's both an auto and a manual, and they are essentially duplicates, delete the manual one
            if (manual.length > 0 && auto.length > 0) {
                console.log(`Deleting ${manual.length} manual notification(s) in favor of the automatic one.`);
                for (const m of manual) {
                    await prisma.notification.delete({ where: { id: m.id } });
                    deletedCount++;
                }
            } else if (auto.length > 1) {
                // Keep the most recent auto one
                auto.sort((a, b) => b.createdAt - a.createdAt);
                for (let i = 1; i < auto.length; i++) {
                     await prisma.notification.delete({ where: { id: auto[i].id } });
                     deletedCount++;
                }
            }
        }
    }

    console.log(`Cleaned up ${deletedCount} duplicate notifications.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
