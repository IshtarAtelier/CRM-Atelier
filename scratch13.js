const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const completedRecent = await prisma.clientTask.findMany({
        where: { 
            status: 'COMPLETED',
            updatedAt: { gte: today }
        },
        include: { client: { select: { name: true } } }
    });
    
    console.log(`Recent COMPLETED Tasks: ${completedRecent.length}`);
    completedRecent.forEach(t => console.log(`- ${t.client.name}: ${t.description} (Updated: ${t.updatedAt})`));
}
test();
