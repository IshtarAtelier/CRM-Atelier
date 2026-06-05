import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const clientsToUpdate = await prisma.client.findMany({
    where: {
      OR: [
        { status: 'CLIENT' },
        { contactSource: { in: ['Calle', 'CALLE', 'Cliente de calle', 'clientes de calle'] } },
        { interest: { contains: 'local', mode: 'insensitive' } }
      ]
    },
    select: { id: true }
  });

  console.log(`Found ${clientsToUpdate.length} clients to backfill STORE_VISIT interactions.`);

  let createdCount = 0;
  for (const client of clientsToUpdate) {
    // Check if they already have one
    const existing = await prisma.interaction.findFirst({
      where: { clientId: client.id, type: 'STORE_VISIT' }
    });

    if (!existing) {
      await prisma.interaction.create({
        data: {
          clientId: client.id,
          type: 'STORE_VISIT',
          content: '📍 Cliente visitó el local (aplicado retroactivamente)'
        }
      });
      createdCount++;
    }
  }

  console.log(`Successfully created ${createdCount} new STORE_VISIT interactions.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
