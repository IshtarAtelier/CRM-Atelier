import { prisma } from './src/lib/db';

async function check() {
    const all = await prisma.order.findMany({
        where: { 
            smartLabProgress: { not: null }
        },
        select: {
            id: true,
            labOrderNumber: true,
            smartLabProgress: true,
            labStatus: true
        }
    });
    console.log("Orders with progress:", all);
}

check().catch(console.error).finally(() => process.exit(0));
