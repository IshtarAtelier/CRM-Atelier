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
      isDeleted: true,
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
      client: true
    }
  });

  console.log(`Deleted orders (sales) in June 2026: ${orders.length}`);
  
  const clientCounts = {};
  for (const o of orders) {
    const name = o.client?.name || 'Desconocido';
    clientCounts[name] = (clientCounts[name] || 0) + 1;
  }
  
  console.log('Client name distribution of deleted orders:');
  console.log(JSON.stringify(clientCounts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
