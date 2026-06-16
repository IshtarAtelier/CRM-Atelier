import { prisma } from './src/lib/db';

async function check() {
    const oldFinished = await prisma.order.findMany({
        where: { 
            smartLabProgress: { gte: 100 },
            labStatus: { in: ['SENT', 'IN_PROGRESS'] }
        }
    });
    console.log("Old Finished orders (progress 100 but not FINISHED state):", oldFinished.length);
    console.log("IDs:", oldFinished.map((o: any) => o.id));
}

check().catch(console.error).finally(() => process.exit(0));
