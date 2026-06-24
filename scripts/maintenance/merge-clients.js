const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeClients(sourceId, targetId) {
  console.log(`Merging client ${sourceId} into ${targetId}`);

  const source = await prisma.client.findUnique({
    where: { id: sourceId },
    include: {
      tags: true,
      tasks: true,
      interactions: true,
      orders: true,
      prescriptions: true,
      whatsappChats: true
    }
  });

  const target = await prisma.client.findUnique({
    where: { id: targetId },
    include: { tags: true }
  });

  if (!source) throw new Error("Source not found");
  if (!target) throw new Error("Target not found");

  // Move related entities
  if (source.tasks.length > 0) {
    await prisma.clientTask.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId }
    });
  }

  if (source.interactions.length > 0) {
    await prisma.interaction.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId }
    });
  }

  if (source.orders.length > 0) {
    await prisma.order.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId }
    });
  }

  if (source.prescriptions.length > 0) {
    await prisma.prescription.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId }
    });
  }

  if (source.whatsappChats.length > 0) {
    await prisma.whatsAppChat.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId }
    });
  }

  // Handle Tags
  const newTagIds = source.tags
    .map(t => t.id)
    .filter(id => !target.tags.some(tt => tt.id === id));
  
  // Merge client data
  const dataToUpdate = {};
  if (!target.email && source.email) dataToUpdate.email = source.email;
  if (!target.phone && source.phone) dataToUpdate.phone = source.phone;
  if (!target.dni && source.dni) dataToUpdate.dni = source.dni;
  if (!target.address && source.address) dataToUpdate.address = source.address;
  if (!target.insurance && source.insurance) dataToUpdate.insurance = source.insurance;
  if (!target.doctor && source.doctor) dataToUpdate.doctor = source.doctor;
  if (!target.contactSource && source.contactSource) dataToUpdate.contactSource = source.contactSource;
  if (!target.interest && source.interest) dataToUpdate.interest = source.interest;

  if (newTagIds.length > 0) {
    dataToUpdate.tags = {
      connect: newTagIds.map(id => ({ id }))
    };
  }

  if (Object.keys(dataToUpdate).length > 0) {
    await prisma.client.update({
      where: { id: targetId },
      data: dataToUpdate
    });
  }

  // Finally delete source
  await prisma.client.delete({
    where: { id: sourceId }
  });

  console.log("Merge completed successfully.");
}

mergeClients('cmqr0iy8j000uxusvhbpbfy24', 'cmqr2nb3d00021klwfdu50g1g')
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
