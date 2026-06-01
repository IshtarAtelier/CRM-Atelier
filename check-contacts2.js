const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const may1 = new Date('2026-05-01T00:00:00Z');
  
  const contacts = await prisma.client.findMany({
    where: {
      createdAt: {
        gte: may1
      }
    }
  });

  console.log(`Total created in May: ${contacts.length}`);
  if (contacts.length > 0) {
    // Group by contactSource
    const sources = contacts.reduce((acc, c) => {
      const key = c.contactSource || 'NULL';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    console.log("Sources:", sources);
    
    // Group by Date (YYYY-MM-DD)
    const dates = contacts.reduce((acc, c) => {
      const d = c.createdAt.toISOString().split('T')[0];
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    console.log("Dates:", dates);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
