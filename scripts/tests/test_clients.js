const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { name: true, contactSource: true, createdAt: true, createdBy: true }
  });
  console.log(JSON.stringify(clients, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
