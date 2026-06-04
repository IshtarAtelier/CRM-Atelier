import { prisma } from '../src/lib/db';

async function check() {
  const clients = await prisma.client.findMany({
    where: { phone: { contains: '3516363780' } },
    include: {
      orders: true,
      prescriptions: true,
      interactions: true,
      whatsappChats: true
    }
  });

  clients.forEach(c => {
    console.log(`\nFicha: ${c.name}`);
    console.log(`Fecha de creación: ${new Date(c.createdAt).toLocaleString('es-AR')}`);
    console.log(`Ventas: ${c.orders.length}`);
    console.log(`Recetas: ${c.prescriptions.length}`);
    console.log(`Chats de WhatsApp: ${c.whatsappChats.length}`);
    console.log(`Interacciones/Notas: ${c.interactions.length}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
