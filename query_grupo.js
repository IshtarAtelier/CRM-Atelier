const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      orderType: 'SALE',
      isDeleted: false
    },
    include: {
      items: {
        include: { product: true }
      },
      tags: true,
      client: true
    }
  });

  const stats = {};

  for (const order of orders) {
    const date = new Date(order.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!stats[monthKey]) {
      stats[monthKey] = { revenue: 0, cost: 0, ordersCount: new Set() };
    }

    const has2x1Tag = order.tags?.some(t => t.name.toLowerCase().includes('2x1')) || false;
    const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag;

    for (const item of order.items) {
      const product = item.product;
      if (!product) continue;
      
      const labName = (product.laboratory || '').toUpperCase();
      if (!labName.includes('GRUPO')) continue; // Filter for Grupo Optico

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

      stats[monthKey].cost += itemCost;
      stats[monthKey].revenue += itemRevenue;
      stats[monthKey].ordersCount.add(order.id);
    }
  }

  console.log("=== Gastos en Grupo Óptico por Mes ===");
  const sortedMonths = Object.keys(stats).sort();
  for (const m of sortedMonths) {
    if (stats[m].cost > 0 || stats[m].revenue > 0) {
      console.log(`Mes: ${m} | Costo: $${stats[m].cost.toLocaleString('es-AR')} | Facturación: $${stats[m].revenue.toLocaleString('es-AR')} | Trabajos: ${stats[m].ordersCount.size}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
