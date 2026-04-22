import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("USERS:", users.map(u => u.name));

  const allMatias = await prisma.clientTask.findMany({
    where: {
      OR: [
        { description: { contains: 'matias', mode: 'insensitive' } },
        { createdBy: { contains: 'matias', mode: 'insensitive' } }
      ]
    }
  });
  console.log("Tasks created by / mentioning matias:", allMatias);

}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
