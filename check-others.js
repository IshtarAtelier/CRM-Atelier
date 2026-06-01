const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const may1 = new Date('2026-05-01T00:00:00Z');
  const may24_start = new Date('2026-05-24T00:00:00Z');
  const may24_end = new Date('2026-05-24T23:59:59Z');
  
  const othersInMay = await prisma.client.findMany({
    where: {
      createdAt: { gte: may1 },
      NOT: {
        createdAt: { gte: may24_start, lte: may24_end }
      }
    },
    include: {
      interactions: true
    }
  });

  console.log(`Other clients created in May: ${othersInMay.length}`);
  
  let withImportInteraction = 0;
  for (const c of othersInMay) {
    const hasImport = c.interactions.some(i => i.content.includes('SISTEMA ANTERIOR') || i.content.includes('ATELIER 1 + 2'));
    if (hasImport) {
      withImportInteraction++;
    }
  }
  
  console.log(`Other clients with import interaction: ${withImportInteraction}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
