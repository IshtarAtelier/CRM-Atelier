const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const client = await prisma.client.findFirst({
    where: { name: { contains: 'Lara Esbry', mode: 'insensitive' } },
    include: { orders: { where: { id: { endsWith: 'mc59' } } } }
  });

  if (!client || client.orders.length === 0) {
    console.log('Order or Client not found');
    return;
  }

  const orderId = client.orders[0].id;
  console.log(`Fixing order ${orderId} for ${client.name}`);

  // Update back to READY
  await prisma.order.update({
    where: { id: orderId },
    data: { labStatus: 'READY' }
  });

  // Check for tasks
  const task = await prisma.clientTask.findFirst({
    where: { clientId: client.id, description: { contains: 'Solicitar comentario' } }
  });

  if (task) {
    console.log('Deleting existing task:', task.id);
    await prisma.clientTask.delete({ where: { id: task.id } });
  }

  console.log('Fixed. Order is back to READY.');
}

fix().catch(console.error).finally(() => prisma.$disconnect());
