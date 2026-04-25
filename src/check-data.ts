import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const allPendingSales = await prisma.order.findMany({
        where: { orderType: 'SALE', isDeleted: false },
        select: { total: true, paid: true }
    });
    console.log('Total SALE orders:', allPendingSales.length);
    const sum = allPendingSales.reduce((acc, o) => acc + (o.total - (o.paid || 0)), 0);
    console.log('Current calculation sum:', sum);
    
    const sumPositive = allPendingSales.reduce((acc, o) => acc + Math.max(0, o.total - (o.paid || 0)), 0);
    console.log('Positive balance sum:', sumPositive);

    const tagsCount = await prisma.tag.count();
    console.log('Tags count in DB:', tagsCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
