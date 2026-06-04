import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sources = await prisma.client.groupBy({
    by: ['contactSource'],
    _count: true
  });
  console.log("Sources:", sources);
  
  const interactions = await prisma.interaction.groupBy({
    by: ['type'],
    _count: true
  });
  console.log("Interactions:", interactions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
