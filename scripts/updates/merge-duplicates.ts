import { prisma } from '../src/lib/db';

async function mergeDuplicates() {
  const allClients = await prisma.client.findMany({
    include: {
      whatsappChats: true,
      orders: true,
      tags: true
    }
  });

  const duplicateGroups: Record<string, any[]> = {};
  
  allClients.forEach(c => {
    let key = null;
    if (c.phone && c.phone.replace(/\D/g, '').length >= 8) {
      key = 'phone_' + c.phone.replace(/\D/g, '').slice(-8);
    } else if (c.dni && c.dni.trim().length > 0) {
      key = 'dni_' + c.dni.trim();
    } else if (c.email && c.email.trim().length > 0) {
      key = 'email_' + c.email.trim().toLowerCase();
    } else {
      key = 'name_' + c.name.trim().toLowerCase();
    }
    
    if (key) {
      if (!duplicateGroups[key]) duplicateGroups[key] = [];
      duplicateGroups[key].push(c);
    }
  });

  const exactDuplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
  console.log(`Starting merge for ${exactDuplicates.length} groups of duplicates.`);
  
  for (const group of exactDuplicates) {
    // Determine primary
    // 1. Has WhatsApp Chat?
    // 2. Has most orders?
    // 3. Oldest
    group.sort((a, b) => {
      if (a.whatsappChats.length !== b.whatsappChats.length) return b.whatsappChats.length - a.whatsappChats.length;
      if (a.orders.length !== b.orders.length) return b.orders.length - a.orders.length;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const primary = group[0];
    const duplicates = group.slice(1);
    
    const duplicateIds = duplicates.map(d => d.id);
    const duplicateNames = duplicates.map(d => d.name).join(', ');
    
    console.log(`Merging into Primary: [${primary.id}] ${primary.name}`);
    console.log(`- Duplicates to delete: ${duplicateIds.join(', ')}`);

    // Collect all tags to connect to primary
    const tagsToConnect = new Set<string>();
    duplicates.forEach(d => d.tags.forEach((t: any) => tagsToConnect.add(t.id)));

    await prisma.$transaction(async (tx) => {
      // 1. Move Orders
      await tx.order.updateMany({
        where: { clientId: { in: duplicateIds } },
        data: { clientId: primary.id }
      });

      // 2. Move Prescriptions
      await tx.prescription.updateMany({
        where: { clientId: { in: duplicateIds } },
        data: { clientId: primary.id }
      });

      // 3. Move Interactions
      await tx.interaction.updateMany({
        where: { clientId: { in: duplicateIds } },
        data: { clientId: primary.id }
      });

      // 4. Move ClientTasks
      await tx.clientTask.updateMany({
        where: { clientId: { in: duplicateIds } },
        data: { clientId: primary.id }
      });

      // 5. Move WhatsAppChats
      await tx.whatsAppChat.updateMany({
        where: { clientId: { in: duplicateIds } },
        data: { clientId: primary.id }
      });

      // 6. Add tags to primary
      if (tagsToConnect.size > 0) {
        await tx.client.update({
          where: { id: primary.id },
          data: {
            tags: {
              connect: Array.from(tagsToConnect).map(id => ({ id }))
            }
          }
        });
      }

      // 7. Add a Note interaction
      await tx.interaction.create({
        data: {
          clientId: primary.id,
          type: 'NOTE',
          content: `🔄 FICHA FUSIONADA. Se combinaron los historiales de otras fichas duplicadas asociadas a este número. Nombres anteriores: ${duplicateNames}.`
        }
      });

      // 8. Delete the duplicates
      await tx.client.deleteMany({
        where: { id: { in: duplicateIds } }
      });
    });

    console.log(`✓ Group merged successfully.\n`);
  }
  
  console.log(`Merge complete! Merged ${exactDuplicates.length} groups.`);
}

mergeDuplicates().catch(console.error).finally(() => prisma.$disconnect());
