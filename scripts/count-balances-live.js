const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Usamos la URL de producción si está disponible
const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});

// Copia exacta del PricingService en JS para evaluar saldos
class PricingService {
    static calculateOrderFinancials(order) {
        const discCash = order.discountCash ?? 20;
        const discTrans = order.discountTransfer ?? 15;
        const listPrice = order.subtotalWithMarkup || 0;

        const totalCash = Math.round(listPrice * (1 - discCash / 100));
        const totalTransfer = Math.round(listPrice * (1 - discTrans / 100));
        const totalCard = listPrice;

        const listEquivalentPaid = (order.payments || []).reduce((acc, p) => {
            const amount = p.amount || 0;
            const method = (p.method || '').toUpperCase().trim();
            const factorCash = 1 - (discCash / 100);
            const factorTrans = 1 - (discTrans / 100);

            const isCash = ['CASH', 'EFECTIVO', 'EFVO'].includes(method);
            const isTrans = ['TRANSFER', 'TRANSFERENCIA', 'TRANSF', 'DEPOSITO'].some(m => method.includes(m));

            if (isCash && factorCash > 0) return acc + (amount / factorCash);
            if (isTrans && factorTrans > 0) return acc + (amount / factorTrans);
            return acc + amount;
        }, 0);

        const paidRealFromPayments = (order.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
        const paidReal = Math.max(paidRealFromPayments, order.paid || 0);
        const finalListEquivalentPaid = (listEquivalentPaid === 0 && paidReal > 0) ? paidReal : listEquivalentPaid;

        const remainingList = Math.max(0, listPrice - finalListEquivalentPaid);
        const hasBalance = remainingList > 1000;

        return {
            remainingCash: Math.round(remainingList * (1 - discCash / 100)),
            remainingTransfer: Math.round(remainingList * (1 - discTrans / 100)),
            remainingCard: Math.round(remainingList),
            hasBalance,
            paidReal,
            listPrice
        };
    }
}

async function main() {
    console.log("=========================================");
    console.log("🤖 CONTADOR DE SALDOS PENDIENTES CRM");
    console.log(`📡 Conectando a: ${dbUrl.split('@')[1] || 'localhost'}`);
    console.log("=========================================");

    // 1. Obtener todos los clientes con órdenes de venta no eliminadas
    const clients = await prisma.client.findMany({
        where: {
            orders: {
                some: {
                    orderType: 'SALE',
                    isDeleted: false
                }
            }
        },
        include: {
            orders: {
                where: { isDeleted: false },
                include: { 
                    payments: true,
                }
            }
        }
    });

    let clientsWithBalanceCount = 0;
    let totalPendingAmount = 0;
    const balanceClientsList = [];

    let totalSalesCount = 0;
    let salesWithBalanceCount = 0;

    for (const client of clients) {
        let clientRemainingCash = 0;
        let clientRemainingTransfer = 0;
        let clientRemainingCard = 0;
        let clientHasAnyBalance = false;
        
        const clientSalesWithBalance = [];

        for (const order of client.orders) {
            if (order.orderType === 'SALE') {
                totalSalesCount++;
                const financials = PricingService.calculateOrderFinancials(order);
                if (financials.hasBalance) {
                    salesWithBalanceCount++;
                    clientRemainingCash += financials.remainingCash;
                    clientRemainingTransfer += financials.remainingTransfer;
                    clientRemainingCard += financials.remainingCard;
                    clientHasAnyBalance = true;
                    clientSalesWithBalance.push({
                        id: order.id,
                        date: order.createdAt,
                        remainingCard: financials.remainingCard
                    });
                }
            }
        }

        if (clientHasAnyBalance && clientRemainingCard > 1000) {
            clientsWithBalanceCount++;
            totalPendingAmount += clientRemainingCard;
            balanceClientsList.push({
                name: client.name,
                remainingCard: clientRemainingCard,
                remainingCash: clientRemainingCash,
                remainingTransfer: clientRemainingTransfer,
                sales: clientSalesWithBalance
            });
        }
    }

    // Ordenar de mayor a menor saldo de tarjeta (lista)
    balanceClientsList.sort((a, b) => b.remainingCard - a.remainingCard);

    console.log(`\n📊 Métrica general:`);
    console.log(`- Total ventas (SALE) en DB: ${totalSalesCount}`);
    console.log(`- Ventas con saldo pendiente: ${salesWithBalanceCount}`);
    console.log(`- Clientes con saldo pendiente (> $1000): ${clientsWithBalanceCount}`);
    console.log(`- Deuda total global (Precio Lista/Tarjeta): $${totalPendingAmount.toLocaleString('es-AR')}`);
    
    console.log(`\n📋 Lista detallada de clientes con saldo:`);
    balanceClientsList.forEach((c, idx) => {
        console.log(`\n${idx + 1}. 👤 ${c.name}`);
        console.log(`   - Saldo Tarjeta/Lista:  $${c.remainingCard.toLocaleString('es-AR')}`);
        console.log(`   - Saldo Efectivo:      $${c.remainingCash.toLocaleString('es-AR')}`);
        console.log(`   - Saldo Transferencia: $${c.remainingTransfer.toLocaleString('es-AR')}`);
        console.log(`   - Pedidos asociados:`);
        c.sales.forEach(s => {
            const dateStr = new Date(s.date).toISOString().split('T')[0];
            console.log(`     * ID: ...${s.id.slice(-6).toUpperCase()} (${dateStr}) - Saldo: $${s.remainingCard.toLocaleString('es-AR')}`);
        });
    });

    console.log("\n=========================================");
}

main()
    .catch(err => {
        console.error("❌ Error ejecutando el script:", err);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
