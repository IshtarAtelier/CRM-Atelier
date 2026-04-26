const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLabs() {
    const products = await prisma.product.findMany({
        select: { laboratory: true },
        distinct: ['laboratory']
    });
    console.log("Distinct Product laboratories:", products.map(p => p.laboratory));
    
    // Check cash movements just in case
    const movements = await prisma.cashMovement.findMany({
        select: { laboratory: true },
        distinct: ['laboratory']
    });
    console.log("Distinct CashMovement laboratories:", movements.map(m => m.laboratory));
    
    process.exit(0);
}

checkLabs();
