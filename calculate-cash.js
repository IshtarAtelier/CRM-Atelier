const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

async function breakdown() {
    try {
        console.log('--- Breakdown of Cash Balance ---');

        // 1. Payments in Cash
        const paymentsAgg = await prisma.payment.aggregate({
            where: {
                method: { in: ['EFECTIVO', 'CASH'] },
                order: {
                    isDeleted: false,
                    orderType: 'SALE'
                }
            },
            _sum: { amount: true }
        });
        const paymentsTotal = paymentsAgg._sum.amount || 0;
        console.log(`\nTotal from Payments: $${paymentsTotal.toLocaleString('es-AR')}`);
        
        // Show recent payments
        console.log('Recent cash payments:');
        payments.sort((a,b) => b.date.getTime() - a.date.getTime()).slice(0, 10).forEach(p => {
             console.log(`- ${p.date.toISOString().split('T')[0]}: $${p.amount.toLocaleString('es-AR')} (Order: ${p.orderId})`);
        });

        // 2. Cash Movements
        const movements = await prisma.cashMovement.findMany({
            include: { user: true }
        });

        const manualIN = movements.filter(m => m.type === 'IN').reduce((acc, m) => acc + m.amount, 0);
        const manualOUT = movements.filter(m => m.type === 'OUT').reduce((acc, m) => acc + m.amount, 0);
        const manualBalance = manualIN - manualOUT;

        console.log(`\nManual Movements Balance: $${manualBalance.toLocaleString('es-AR')}`);
        console.log(`- Manual IN: $${manualIN.toLocaleString('es-AR')}`);
        console.log(`- Manual OUT: $${manualOUT.toLocaleString('es-AR')}`);

        if (movements.length > 0) {
            console.log('Recent manual movements:');
            movements.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10).forEach(m => {
                console.log(`- ${m.createdAt.toISOString().split('T')[0]} [${m.type}]: $${m.amount.toLocaleString('es-AR')} - ${m.reason} (By: ${m.user.name})`);
            });
        }

        const total = paymentsTotal + manualBalance;
        console.log(`\nFINAL TOTAL: $${total.toLocaleString('es-AR')}`);
        
    } catch (e) {
        console.error('Error during breakdown:', e.message);
        if (e.stack) console.error(e.stack);
    } finally {
        await prisma.$disconnect();
    }
}

breakdown();
