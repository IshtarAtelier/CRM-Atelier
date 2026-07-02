import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { name: 'Milena Magallanes ' },
    data: { email: 'milena' } // The 'email' column is used as the username
  });
  console.log(`Username updated successfully for ${result.count} users.`);
}
main().finally(() => prisma.$disconnect());
