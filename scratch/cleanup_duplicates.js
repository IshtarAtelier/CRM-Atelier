const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const notifications = await prisma.notification.findMany({
        where: {
            type: 'INVOICE_REQUEST',
            status: 'PENDING'
        },
        orderBy: {
            createdAt: 'asc' // Older ones first
        }
    });

    console.log(`Found ${notifications.length} pending invoice requests...`);

    const seen = new Set();
    const duplicates = [];

    for (const notif of notifications) {
        if (!notif.orderId) continue;
        
        // Extract amount from message
        const amountMatch = notif.message.match(/\$([0-9.,]+)/);
        if (!amountMatch) continue;
        
        const amountStr = amountMatch[1];
        
        // Uniqueness key: orderId + amountStr
        const key = `${notif.orderId}_${amountStr}`;

        if (seen.has(key)) {
            duplicates.push(notif);
        } else {
            seen.add(key);
        }
    }

    console.log(`Found ${duplicates.length} duplicate requests.`);

    for (const dup of duplicates) {
        console.log(`- Duplicado a eliminar: ${dup.id} | ${dup.message} | ${dup.createdAt}`);
        await prisma.notification.delete({
            where: { id: dup.id }
        });
    }

    console.log("Cleanup finished.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
