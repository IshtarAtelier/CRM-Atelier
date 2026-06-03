const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

async function main() {
  // 1. Missing expenses for May 2026
  const fixedCosts = await prisma.fixedCost.findMany({
    where: { month: 5, year: 2026 }
  });
  
  const missingExpenses = fixedCosts.filter(f => !f.amount || f.amount === 0);
  console.log("=== Gastos Pendientes de Cargar (Mayo 2026) ===");
  if (missingExpenses.length === 0) {
    console.log("No hay gastos pendientes.");
  } else {
    for (const exp of missingExpenses) {
      console.log(`- ${exp.name} (${exp.category})`);
    }
  }

  // 2. Optovision stats
  const orders = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      isDeleted: false,
      createdAt: {
        gte: new Date('2026-05-01T00:00:00.000Z'),
        lt: new Date('2026-06-01T00:00:00.000Z')
      }
    },
    include: {
      items: {
        include: { product: true }
      },
      tags: true
    }
  });

  let optoCost = 0;
  let optoRevenue = 0;
  let optoOrders = new Set();

  for (const order of orders) {
    const has2x1Tag = order.tags?.some(t => t.name.toLowerCase().includes('2x1')) || false;
    const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag;

    for (const item of order.items) {
      const product = item.product;
      if (!product) continue;
      
      const labName = (product.laboratory || '').toUpperCase();
      if (!labName.includes('OPTOVISION')) continue;

      const cat = (product.category || '').toUpperCase();
      const isCrystalItem = cat.includes('CRISTAL') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal');
      
      if (!isCrystalItem) continue;

      let itemCost = (product.cost || 0) * item.quantity;
      if (product.unitType === 'PAR' && (item.eye === 'OD' || item.eye === 'OI') && (product.cost || 0) > 0) {
        itemCost = ((product.cost || 0) / 2) * item.quantity;
      }

      if (is2x1Order && isCrystalItem && item.price === 0) {
        itemCost = 0;
      }

      const itemRevenue = item.price * item.quantity;

      optoCost += itemCost;
      optoRevenue += itemRevenue;
      optoOrders.add(order.id);
    }
  }

  console.log("\n=== Gastos en Optovision (Mayo 2026) ===");
  console.log(`Costo: $${optoCost.toLocaleString('es-AR')} | Facturación: $${optoRevenue.toLocaleString('es-AR')} | Trabajos: ${optoOrders.size}`);
}

main().finally(() => prisma.$disconnect());
