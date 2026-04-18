const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const ps = await prisma.payment.findMany({
        where: { receiptUrl: { startsWith: '/' } },
        select: {
            id: true, amount: true, method: true, date: true, receiptUrl: true,
            orderId: true,
            order: { select: { client: { select: { name: true } } } }
        },
        orderBy: { date: 'desc' }
    });
    
    const cs = await prisma.cashMovement.findMany({
        where: { receiptUrl: { startsWith: '/' } },
        select: {
            id: true, amount: true, type: true, createdAt: true, reason: true, receiptUrl: true
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log("=== PAGOS ROTOS (VENTAS) ===");
    for (const p of ps) {
        console.log(`- Venta #${p.orderId?.slice(-4).toUpperCase()} | Cliente: ${p.order?.client?.name} | Válido por: $${p.amount.toLocaleString()} (${p.method})`);
    }

    console.log("\n=== MOVIMIENTOS ROTOS (CAJA) ===");
    for (const c of cs) {
        console.log(`- Caja: ${c.type} | $${c.amount.toLocaleString()} | Motivo: ${c.reason}`);
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
