import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    console.log('Starting retroactive invoice request generation...');
    
    // Rango de fecha: todo el mes actual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Obtener pedidos (solo ventas válidas) con sus pagos, notificaciones y facturas
    const orders = await prisma.order.findMany({
        where: {
            orderType: 'SALE',
            isDeleted: false,
        },
        include: {
            client: true,
            payments: {
                where: {
                    createdAt: { gte: startOfMonth }
                }
            },
            invoices: true,
        }
    });

    console.log(`Found ${orders.length} valid sales.`);

    // Fetch existing invoice request notifications
    const existingNotifications = await prisma.notification.findMany({
        where: { type: 'INVOICE_REQUEST' }
    });
    
    const notificationOrderIds = new Set(existingNotifications.filter(n => n.orderId).map(n => n.orderId));

    const cardMethods = ['PAY_WAY', 'NARANJA', 'GO_CUOTAS'];
    let createdCount = 0;

    for (const order of orders) {
        // Skip si ya tiene una factura
        if (order.invoices && order.invoices.length > 0) continue;
        
        // Skip si ya tiene una notificación pendiente
        if (notificationOrderIds.has(order.id)) continue;

        // Verificar si tiene algún pago "facturable" en este mes
        let billablePayment = null;
        for (const payment of order.payments) {
            const method = payment.method.toUpperCase();
            if (cardMethods.some(m => method.includes(m))) {
                billablePayment = payment;
                break; // Solo necesitamos detectar uno para generar el pedido por el total
            }
        }

        if (billablePayment) {
            const method = billablePayment.method.toUpperCase();
            const isIsh = method.endsWith('_ISH');
            const isYani = method.endsWith('_YANI') || method.includes('YANI');
            
            // Default to ISH if neither is specified
            let accountLabel = '';
            if (isIsh) accountLabel = '[ISH]';
            else if (isYani) accountLabel = '[YANI]';
            else accountLabel = '[ISH]';

            const clientName = order.client?.name || 'Cliente';
            // El pedido es por el TOTAL de la orden
            const amount = order.total || 0;

            await prisma.notification.create({
                data: {
                    type: 'INVOICE_REQUEST',
                    message: `${accountLabel} Facturar VENTA COMPLETA de $${amount.toLocaleString('es-AR')} (${method}) - Venta #${order.id.slice(-4).toUpperCase()} (${clientName})`,
                    orderId: order.id,
                    requestedBy: 'SISTEMA (Auto - Retroactivo)',
                    status: 'PENDING'
                }
            });

            console.log(`CREATED request for Order ${order.id.slice(-4)} | Account: ${accountLabel} | Amount: $${amount} | Payment Method: ${method}`);
            createdCount++;
        }
    }

    console.log('--------------------------------------------------');
    console.log(`Done! Created ${createdCount} new billing requests for this month.`);
}

run()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
