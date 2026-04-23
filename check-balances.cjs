const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.order.findMany({
        where: { orderType: 'SALE', isDeleted: false }
    });
    
    let globalBalance = 0;
    let balanceOrdersCount = 0;

    for (const order of orders) {
        const total = order.total || 0;
        const paid = order.paid || 0;
        
        const balance = total - paid;
        if (balance > 0) {
            globalBalance += balance;
            balanceOrdersCount++;
            console.log(`Order ${order.id} has total: ${total}, paid: ${paid}, balance: ${balance}`);
        }
    }
    console.log('---------');
    console.log(`There are ${balanceOrdersCount} orders with balance. Total balance: ${globalBalance}`);
}

main().finally(() => prisma.$disconnect());
