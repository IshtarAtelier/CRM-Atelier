import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const totalTasks = await prisma.clientTask.count();
  console.log(`Total tasks ever created in DB: ${totalTasks}`);

  const tasksByStatus = await prisma.clientTask.groupBy({
    by: ['status'],
    _count: {
      id: true
    }
  });
  console.log("Tasks by status:", tasksByStatus);

  const last10Tasks = await prisma.clientTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { client: { select: { name: true } } }
  });
  console.log("Last 10 tasks created:");
  last10Tasks.forEach(t => console.log(`- ${t.createdAt}: ${t.description} [${t.status}] (Client: ${t.client?.name})`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
