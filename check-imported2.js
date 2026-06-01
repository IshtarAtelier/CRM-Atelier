const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const may1 = new Date('2026-05-01T00:00:00Z');
  
  const tags = await prisma.tag.findMany();
  console.log("All tags:", tags.map(t => t.name));

  const importedClientsInMay = await prisma.client.findMany({
    where: {
      createdAt: { gte: may1 },
      interactions: {
        some: {
          content: {
            contains: 'SISTEMA ANTERIOR'
          }
        }
      }
    }
  });

  console.log(`Imported clients in May with SISTEMA ANTERIOR interaction: ${importedClientsInMay.length}`);

  // Also check how many clients created on May 24th
  const may24_start = new Date('2026-05-24T00:00:00Z');
  const may24_end = new Date('2026-05-24T23:59:59Z');
  const may24_clients = await prisma.client.findMany({
    where: {
      createdAt: {
        gte: may24_start,
        lte: may24_end
      }
    }
  });
  console.log(`Clients created on May 24: ${may24_clients.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
