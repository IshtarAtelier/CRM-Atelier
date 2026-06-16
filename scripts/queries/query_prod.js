const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

async function main() {
  const clients = await prisma.client.findMany({
    where: { name: { contains: 'scorrani', mode: 'insensitive' } },
    include: {
      orders: {
        orderBy: { updatedAt: 'desc' }
      },
      interactions: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });
  console.log(JSON.stringify(clients, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
