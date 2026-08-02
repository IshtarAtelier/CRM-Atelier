import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();
const prisma = new PrismaClient();

const cutoffCreated = new Date(Date.now() - 90 * 86400000);

const oldOrders = await prisma.order.findMany({
  where: {
    isDeleted: false,
    labStatus: 'NONE',
    createdAt: { lte: cutoffCreated },
    clientId: { not: '' },
    items: { some: {} },
  },
  select: {
    id: true,
    createdAt: true,
    client: { select: { id: true, name: true, contactSource: true, status: true, tags: { select: { name: true } } } },
  },
});

console.log(`Total pedidos NONE viejos: ${oldOrders.length}\n`);
const bySource = new Map();
for (const o of oldOrders) {
  const src = o.client?.contactSource || '(vacío)';
  if (!bySource.has(src)) bySource.set(src, []);
  bySource.get(src).push(o.client?.name);
}
for (const [src, names] of bySource) {
  console.log(`contactSource="${src}": ${names.length} pedidos`);
  console.log(`  ej: ${names.slice(0,3).join(', ')}`);
}

console.log('\n--- Tags de los primeros 5 clientes ---');
for (const o of oldOrders.slice(0, 5)) {
  console.log(`${o.client?.name}: tags=[${o.client?.tags.map(t=>t.name).join(', ')}]`);
}

await prisma.$disconnect();
