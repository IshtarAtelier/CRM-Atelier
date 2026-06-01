const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const may1 = new Date('2026-05-01T00:00:00Z');
  
  // Find tag 'Histórico'
  const tag = await prisma.tag.findFirst({
    where: { name: 'Histórico' }
  });
  
  if (!tag) {
    console.log("Tag Histórico not found");
    return;
  }

  const importedClientsInMay = await prisma.client.findMany({
    where: {
      createdAt: { gte: may1 },
      tags: {
        some: {
          id: tag.id
        }
      }
    }
  });

  console.log(`Imported clients in May with Histórico tag: ${importedClientsInMay.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
