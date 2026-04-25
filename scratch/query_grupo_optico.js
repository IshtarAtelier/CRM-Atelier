const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const startOfMonth = new Date('2026-04-01T00:00:00.000Z');
  
  // Orders from this month
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startOfMonth },
      isDeleted: false,
    },
    include: {
      client: true,
      items: {
        include: { product: true }
      }
    }
  });
  
  const results = [];
  let totalCost = 0;
  let totalPrice = 0;
  
  for (const order of orders) {
    let isGrupoOptico = false;
    let orderCost = 0;
    
    for (const item of order.items) {
      if (item.product?.laboratory?.toUpperCase().includes('GRUPO OPTICO') || item.product?.laboratory?.toUpperCase().includes('GRUPO ÓPTICO')) {
        isGrupoOptico = true;
      }
      // Calcular costo sumando el costo de cada item
      orderCost += (item.product?.cost || 0) * item.quantity;
    }
    
    // Check if the order itself has some labStatus or notes
    if (order.labNotes?.toUpperCase().includes('GRUPO') || order.labStatus === 'SENT' /* we might need a better heuristic, let's stick to product laboratory for now */) {
        // Just rely on product lab for now
    }

    if (isGrupoOptico) {
      results.push({
        client: order.client.name,
        cost: orderCost,
        price: order.total
      });
      totalCost += orderCost;
      totalPrice += order.total;
    }
  }
  
  console.log("Client | Cost | Price");
  console.log("---|---|---");
  results.forEach(r => {
    console.log(`${r.client} | $${r.cost} | $${r.price}`);
  });
  console.log(`**TOTAL** | **$${totalCost}** | **$${totalPrice}**`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
