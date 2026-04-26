import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const labs = await prisma.product.findMany({
    select: { laboratory: true },
    distinct: ['laboratory']
  });
  console.log("Distinct labs:", labs.map(l => l.laboratory));

  await prisma.$disconnect();
}

main();
