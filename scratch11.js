const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    const pendingTasks = await prisma.clientTask.findMany({
        where: { status: 'PENDING' },
        include: { client: { select: { name: true } } }
    });
    console.log(`There are ${pendingTasks.length} pending tasks in the database.`);
    pendingTasks.forEach(t => console.log(`- ${t.client?.name}: ${t.description}`));

    const allTasks = await prisma.clientTask.count();
    console.log(`Total tasks ever: ${allTasks}`);
}
test();
