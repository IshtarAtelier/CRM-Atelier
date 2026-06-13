import { prisma } from './src/lib/db';

async function check() {
    const finished = await prisma.order.findMany({
        where: { labStatus: 'FINISHED' }
    });
    console.log("Finished orders:", finished.length);
    
    const inProgress = await prisma.order.findMany({
        where: { labStatus: 'IN_PROGRESS' }
    });
    console.log("In Progress orders:", inProgress.length);

    console.log("Finished orders IDs:", finished.map((f: any) => f.id));
}

check().catch(console.error).finally(() => process.exit(0));
