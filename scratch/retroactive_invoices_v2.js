const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
    console.log('=== STEP 1: Deleting old incorrect retroactive requests ===');
    
    // Delete all requests created by the retroactive script (they used order.total instead of payment amount)
    const deleted = await prisma.notification.deleteMany({
        where: {
            type: 'INVOICE_REQUEST',
            requestedBy: { contains: 'Retroactivo' }
        }
    });
    console.log(`Deleted ${deleted.count} incorrect retroactive requests.`);

    console.log('\n=== STEP 2: Generating correct requests (by payment amount) ===');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const orders = await prisma.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
        },
        include: {
            client: true,
            payments: true,
            invoices: true,
        }
    });

    console.log(`Found ${orders.length} valid sales.`);

    // Fetch existing invoice request notifications (non-retroactive ones that are still valid)
    const existingNotifications = await prisma.notification.findMany({
        where: { type: 'INVOICE_REQUEST', status: 'PENDING' }
    });

    const cardMethods = ['PAY_WAY', 'NARANJA', 'GO_CUOTAS'];
    let createdCount = 0;

    for (const order of orders) {
        // Skip si ya tiene una factura completada
        if (order.invoices && order.invoices.some(inv => inv.status === 'COMPLETED')) continue;

        // Process each card payment individually
        for (const payment of order.payments) {
            if (payment.createdAt < startOfMonth) continue;

            const method = payment.method.toUpperCase();
            if (!cardMethods.some(m => method.includes(m))) continue;

            const amount = payment.amount;
            const amountStr = `$${amount.toLocaleString('es-AR')}`;

            // Check for duplicate: existing notification for same order + same amount
            const alreadyExists = existingNotifications.some(
                n => n.orderId === order.id && n.message && n.message.includes(amountStr)
            );
            if (alreadyExists) {
                console.log(`  SKIP: Order ${order.id.slice(-4)} | Amount: ${amountStr} (already has pending request)`);
                continue;
            }

            const isIsh = method.endsWith('_ISH');
            const isYani = method.endsWith('_YANI') || method.includes('YANI');
            
            let accountLabel = '';
            if (isIsh) accountLabel = '[ISH]';
            else if (isYani) accountLabel = '[YANI]';
            else accountLabel = '[ISH]';

            const clientName = order.client?.name || 'Cliente';

            const notif = await prisma.notification.create({
                data: {
                    type: 'INVOICE_REQUEST',
                    message: `${accountLabel} Facturar pago de ${amountStr} (${method}) - Venta #${order.id.slice(-4).toUpperCase()} (${clientName})`,
                    orderId: order.id,
                    requestedBy: 'SISTEMA (Auto - Retroactivo v2)',
                    status: 'PENDING'
                }
            });

            // Track it so we don't duplicate within this run
            existingNotifications.push(notif);

            console.log(`  CREATED: Order ${order.id.slice(-4)} | Account: ${accountLabel} | Payment: ${amountStr} (${method})`);
            createdCount++;
        }
    }

    console.log('--------------------------------------------------');
    console.log(`Done! Created ${createdCount} correct billing requests (by payment amount).`);
}

run()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
