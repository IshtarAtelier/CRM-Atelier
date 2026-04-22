import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.clientTask.findMany({
      where: { status: 'PENDING' },
      include: { client: true },
      orderBy: { dueDate: 'asc' }
  });
  console.log("Pending fetched:", pending.length);
  pending.forEach(t => console.log(t.id, t.description, t.dueDate));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
