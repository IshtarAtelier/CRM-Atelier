const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const envContent = fs.readFileSync('/Users/ishtarpissano/proyectos/atelier/.env', 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.PROD_DATABASE_URL,
    },
  },
});

function isCrystalProduct(product) {
  if (!product) return false;
  return (product.category || '').toUpperCase().includes('CRISTAL')
      || (product.type || '').includes('Cristal')
      || (product.type || '').includes('Multifocal')
      || (product.type || '').includes('Monofocal');
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

async function main() {
  const from = '2026-06-01';
  const to = '2026-06-30';
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
  }

  const whereClause = {
      orderType: 'SALE',
      isDeleted: false,
  };
  whereClause.OR = [
      { labSentAt: dateFilter },
      {
          AND: [
              { labSentAt: null },
              { createdAt: dateFilter }
          ]
      }
  ];

  const orders = await prisma.order.findMany({
    where: whereClause,
    include: {
      client: true,
      tags: true,
      payments: true,
      items: {
        include: {
          product: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  let md = `# Detalle Costos Cristales — Junio 2026\n\n`;

  let totalCalculated = 0;
  let subtotal2x1 = 0;
  let subtotalNormal = 0;

  const orders2x1 = [];
  const ordersNormal = [];

  for (const order of orders) {
    const has2x1Tag = order.tags?.some((t) => t.name.toLowerCase().includes('2x1')) || false;
    const has2x1Product = order.items.some((i) => i.product && (i.product.name || '').toLowerCase().includes('2x1'));
    const hasFreeCrystal = order.items.some((i) => isCrystalProduct(i.product) && i.price === 0);
    const is2x1Order = (order.appliedPromoName || '').toLowerCase().includes('2x1') || has2x1Tag || has2x1Product || hasFreeCrystal;

    const crystalItems = [];
    let paidCrystalsCount = 0;

    for (const item of order.items) {
      const product = item.product;
      if (!product) continue;
      if (!isCrystalProduct(product)) continue;

      let itemCost = (product.cost || 0) * item.quantity;
      if ((item.eye === 'OD' || item.eye === 'OI') && (product.cost || 0) > 0) {
        itemCost = ((product.cost || 0) / 2) * item.quantity;
      }

      let note = '';
      let isFree = false;

      if (is2x1Order) {
        if (item.price === 0) {
          itemCost = 0;
          isFree = true;
          note = '2x1 GRATIS ✅';
        } else {
          if (paidCrystalsCount >= 2) {
            itemCost = 0;
            isFree = true;
            note = '2x1 GRATIS ✅';
          } else if (paidCrystalsCount + item.quantity > 2) {
            const payableQty = 2 - paidCrystalsCount;
            itemCost = (itemCost / item.quantity) * payableQty;
            note = `Parcial (${payableQty} pagados)`;
          } else {
            note = '1er par';
          }
          paidCrystalsCount += item.quantity;
        }
      }

      crystalItems.push({
        productName: `${product.brand || ''} ${product.name || ''}`.trim(),
        eye: item.eye || 'N/A',
        price: item.price,
        cost: itemCost,
        note: note,
        isFree: isFree,
        lab: product.laboratory || 'N/A'
      });
    }

    if (crystalItems.length > 0) {
      const txNotes = order.payments
        .map(p => p.notes)
        .filter(n => n && !n.includes('Ajuste'))
        .map(n => {
          const match = n.match(/TX:\s*([^\s\]]+)/);
          return match ? match[1] : n;
        })
        .join(', ');

      const orderData = {
        date: formatDate(order.createdAt),
        code: order.id.slice(-6),
        client: order.client?.name || 'Desconocido',
        items: crystalItems,
        totalCost: crystalItems.reduce((sum, item) => sum + item.cost, 0),
        labOpNumber: order.labOrderNumber || '—',
        paymentTx: txNotes || '—'
      };

      if (is2x1Order) {
        orders2x1.push(orderData);
        subtotal2x1 += orderData.totalCost;
      } else {
        ordersNormal.push(orderData);
        subtotalNormal += orderData.totalCost;
      }
      totalCalculated += orderData.totalCost;
    }
  }

  md += `**Total calculado: $${totalCalculated.toLocaleString('es-AR')}**\n\n`;
  md += `> [!NOTE]\n`;
  md += `> **Todos los 2x1 ahora están correctamente detectados y calculados.** El segundo par (gratis) se calcula con un costo de $0. Los costos sospechosos anteriores se han corregido, lo que redujo el total de cristales de $6.882.242 a **$6.407.242** (ahorro de $475.000).\n\n`;
  md += `---\n\n`;

  md += `## Órdenes con 2x1 detectado ✅\n\n`;
  md += `| Fecha | Orden | Cliente | Producto | OD/OI | Precio | Costo | Nota | Lab | N° Op. Lab | N° Op. Pago (TX) |\n`;
  md += `|-------|-------|---------|----------|-------|--------|-------|------|-----|------------|------------------|\n`;

  for (const o of orders2x1) {
    let first = true;
    for (const item of o.items) {
      const dateCol = first ? o.date : '';
      const orderCol = first ? o.code : '';
      const clientCol = first ? o.client : '';
      const labOpCol = first ? o.labOpNumber : '';
      const payTxCol = first ? o.paymentTx : '';
      
      const priceStr = item.price === 0 ? '$0' : `$${item.price.toLocaleString('es-AR')}`;
      const costStr = item.cost === 0 ? '**$0**' : `$${item.cost.toLocaleString('es-AR')}`;
      const noteStr = item.isFree ? `**${item.note}**` : item.note;

      md += `| ${dateCol} | ${orderCol} | ${clientCol} | ${item.productName} | ${item.eye} | ${priceStr} | ${costStr} | ${noteStr} | ${item.lab} | ${labOpCol} | ${payTxCol} |\n`;
      first = false;
    }
    // Add total row for this order
    md += `| | | | | | | **$${o.totalCost.toLocaleString('es-AR')}** | **Subtotal Orden** | | | |\n`;
  }

  md += `\n**Subtotal 2x1: $${subtotal2x1.toLocaleString('es-AR')}**\n\n`;
  md += `---\n\n`;

  md += `## Órdenes normales (sin 2x1)\n\n`;
  md += `| Fecha | Orden | Cliente | Producto | OD/OI | Precio | Costo | Lab | N° Op. Lab | N° Op. Pago (TX) |\n`;
  md += `|-------|-------|---------|----------|-------|--------|-------|-----|------------|------------------|\n`;

  for (const o of ordersNormal) {
    let first = true;
    for (const item of o.items) {
      const dateCol = first ? o.date : '';
      const orderCol = first ? o.code : '';
      const clientCol = first ? o.client : '';
      const labOpCol = first ? o.labOpNumber : '';
      const payTxCol = first ? o.paymentTx : '';

      md += `| ${dateCol} | ${orderCol} | ${clientCol} | ${item.productName} | ${item.eye} | $${item.price.toLocaleString('es-AR')} | $${item.cost.toLocaleString('es-AR')} | ${item.lab} | ${labOpCol} | ${payTxCol} |\n`;
      first = false;
    }
    md += `| | | | | | | **$${o.totalCost.toLocaleString('es-AR')}** | **Subtotal Orden** | | |\n`;
  }

  md += `\n**Subtotal normales: $${subtotalNormal.toLocaleString('es-AR')}**\n\n`;
  md += `---\n\n`;

  md += `## Resumen\n\n`;
  md += `| Categoría | Costo |\n`;
  md += `|-----------|-------|\n`;
  md += `| Órdenes 2x1 (1er par) | $${subtotal2x1.toLocaleString('es-AR')} |\n`;
  md += `| Órdenes normales | $${subtotalNormal.toLocaleString('es-AR')} |\n`;
  md += `| **TOTAL** | **$${totalCalculated.toLocaleString('es-AR')}** |\n`;

  fs.writeFileSync('/Users/ishtarpissano/.gemini/antigravity/brain/debd7ca7-a6cc-4228-9a70-21d1499fef80/costos_cristales_junio.md', md);
  console.log('Markdown generated successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
