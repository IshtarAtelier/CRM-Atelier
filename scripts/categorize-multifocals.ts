import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando categorización manual de multifocales...');

  // 1. Identificar productos multifocales
  const multifocalKeywords = ['multifocal', 'progresivo', 'varilux', 'smart', 'kodak'];
  
  const allProducts = await prisma.product.findMany();
  const multifocalProducts = allProducts.filter(p => {
    const fullText = `${p.name} ${p.brand} ${p.model} ${p.type}`.toLowerCase();
    return multifocalKeywords.some(kw => fullText.includes(kw));
  });

  const multifocalProductIds = multifocalProducts.map(p => p.id);
  console.log(`Encontrados ${multifocalProductIds.length} productos que coinciden con multifocal.`);

  // 2. Buscar presupuestos o ventas (orders) que contengan estos productos o que tengan tipo Multifocal/Cristal
  const ordersWithMultifocals = await prisma.order.findMany({
    where: {
      items: {
        some: {
          product: {
            OR: [
              { id: { in: multifocalProductIds } },
              { type: { contains: 'Multifocal', mode: 'insensitive' } }
            ]
          }
        }
      }
    },
    include: {
      client: true
    }
  });

  // 3. Obtener clientes únicos a actualizar
  const clientsToUpdate = new Map<string, any>();
  
  for (const order of ordersWithMultifocals) {
    if (order.client && (!order.client.interest || !order.client.interest.toLowerCase().includes('multifocal'))) {
      clientsToUpdate.set(order.client.id, order.client);
    }
  }

  console.log(`Se encontraron ${clientsToUpdate.size} clientes para actualizar su categoría a Multifocal.`);

  // 4. Actualizar clientes
  let count = 0;
  for (const [clientId, client] of clientsToUpdate.entries()) {
    const newInterest = client.interest ? `${client.interest}, Multifocal` : 'Multifocal';
    await prisma.client.update({
      where: { id: clientId },
      data: { interest: newInterest }
    });
    count++;
  }

  console.log(`¡Proceso completado! Se actualizaron ${count} clientes exitosamente.`);
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
