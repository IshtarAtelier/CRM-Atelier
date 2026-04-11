const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();
const { CashService } = require('./src/services/cash.service');

// We need to polyfill Next.js env or ensure CashService uses the generated PrismaClient.
// Actually, CashService imports from '@/lib/db' which initializes Prisma.
// Let's just do everything using the pure PrismaClient to ensure we don't hit path resolution issues.

async function testPayments() {
    try {
        console.log('--- INICIANDO PRUEBA DE CARGA DE PAGOS ---');
        
        // Find an admin user to assign dummy orders and movements
        const user = await prisma.user.findFirst();
        if (!user) throw new Error("No users found to assign a test payment.");

        // Create a dummy client
        const client = await prisma.client.create({
            data: {
                name: 'Cliente Test Caja',
                phone: '12345678',
            }
        });

        // Create a dummy SALE order
        const saleOrder = await prisma.order.create({
            data: {
                clientId: client.id,
                userId: user.id,
                orderType: 'SALE',
                total: 50000,
            }
        });

        // Create a dummy QUOTE order (Presupuesto)
        const quoteOrder = await prisma.order.create({
            data: {
                clientId: client.id,
                userId: user.id,
                orderType: 'QUOTE',
                total: 80000,
            }
        });

        // 1. Añadir pago en EFECTIVO a la VENTA (Debe sumar $20.000)
        await prisma.payment.create({
            data: {
                orderId: saleOrder.id,
                amount: 20000,
                method: 'EFECTIVO',
                notes: 'Test de cobro en efectivo VENTA'
            }
        });

        // 2. Añadir pago en TRANSFERENCIA a la VENTA (No debe sumar a la caja de efectivo)
        await prisma.payment.create({
            data: {
                orderId: saleOrder.id,
                amount: 15000,
                method: 'TRANSFER',
                notes: 'Test de cobro por transferencia'
            }
        });

        // 3. Añadir pago en EFECTIVO a un PRESUPUESTO (No debe sumar)
        await prisma.payment.create({
            data: {
                orderId: quoteOrder.id,
                amount: 5000,
                method: 'EFECTIVO',
                notes: 'Seña de PRESUPUESTO (No debe calcularse como venta)'
            }
        });

        console.log('Pagos insertados en la base de datos.');

        // Replicar función getCashBalance
        const cashPayments = await prisma.payment.findMany({
            where: { 
                method: { in: ['EFECTIVO', 'CASH'] },
                order: {
                    isDeleted: false,
                    orderType: 'SALE'
                }
            },
            include: {
                order: { include: { client: true, user: true } }
            }
        });
        const paymentsTotal = cashPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

        const movementsList = await prisma.cashMovement.findMany({ include: { user: true } });
        let manualIn = 0; let manualOut = 0;
        movementsList.forEach((mov) => {
            if (mov.type === 'IN') manualIn += mov.amount;
            if (mov.type === 'OUT') manualOut += mov.amount;
        });
        const manualBalance = manualIn - manualOut;
        const totalCash = paymentsTotal + manualBalance;

        // Mostrar resultados
        console.log('\n--- RESULTADOS DEL BALANCE LUEGO DE INSERTAR PAGOS ---');
        console.log('Total Efectivo en Caja Esperado: ', totalCash);
        console.log('Suma de Pagos EFECTIVO en Ventas:', paymentsTotal);
        console.log('Total Ingresos Manuales:', manualIn);
        console.log('Total Egresos Manuales:', manualOut);
        
        console.log('\nÚltimos 3 registros que aparecerán en el "Historial de Movimientos" de la UI:');
        
        const formattedPayments = cashPayments.map((p) => ({
            id: p.id,
            type: 'IN',
            amount: p.amount || 0,
            reason: `Cobro Venta - ${p.order?.client?.name || 'Cliente'}`,
            category: 'VENTA',
            createdAt: p.date, 
            user: { name: p.order?.user?.name || 'Vendedor' }
        }));
        const allMovements = [...movementsList, ...formattedPayments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
        
        allMovements.forEach(m => {
            console.log(`- [${m.type}] $${m.amount} | ${m.category} | ${m.reason}`);
        });

        // Limpiar la base de datos (Opcional, para no ensuciar la DB local del usuario si es de prueba)
        await prisma.payment.deleteMany({ where: { orderId: { in: [saleOrder.id, quoteOrder.id] } } });
        await prisma.order.deleteMany({ where: { id: { in: [saleOrder.id, quoteOrder.id] } } });
        await prisma.client.delete({ where: { id: client.id } });
        
        console.log('\nDatabase cleanup complete. Tareas de testeo finalizadas.');

    } catch (error) {
        console.error('Error in testing:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testPayments();
