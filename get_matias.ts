import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'matias',
        mode: 'insensitive',
      }
    }
  });
  console.log(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
}
main().finally(() => prisma.$disconnect());
