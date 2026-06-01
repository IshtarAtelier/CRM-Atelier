const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const may24_start = new Date('2026-05-24T00:00:00Z');
  const may24_end = new Date('2026-05-24T23:59:59Z');
  
  const contacts = await prisma.client.findMany({
    where: {
      createdAt: {
        gte: may24_start,
        lte: may24_end
      }
    }
  });

  console.log(`Total created on May 24: ${contacts.length}`);
  const sources = contacts.reduce((acc, c) => {
    const key = c.contactSource || 'NULL';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log("Sources on May 24:", sources);
}

main().catch(console.error).finally(() => prisma.$disconnect());
