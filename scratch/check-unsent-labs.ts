import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = trimmed.substring('DATABASE_URL='.length).replace(/^"|"$/g, '');
  }
}

const prisma = new PrismaClient();

async function main() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const paymentsThisMonth = await prisma.payment.findMany({
    where: { date: { gte: monthStart }, order: { isDeleted: false } },
    include: {
      order: {
        include: {
          client: true,
          items: {
            include: {
              product: true
            }
          }
        }
      }
    }
  });

  const unsentOrders = new Map();

  for (const p of paymentsThisMonth) {
    if (p.order.orderType === 'SALE') {
      // Check labStatus or if it needs to be sent
      const isLabNeeded = p.order.items.some(i => i.product?.category?.toLowerCase().includes('cristal') || i.product?.category?.toLowerCase().includes('lente'));
      
      // If labStatus is 'NONE' or 'PENDING' and it needs lab
      if ((!p.order.labStatus || p.order.labStatus === 'NONE' || p.order.labStatus === 'PENDING') && isLabNeeded) {
        if (!unsentOrders.has(p.order.id)) {
          unsentOrders.set(p.order.id, {
            clientName: p.order.client?.name,
            totalPaid: 0,
            labStatus: p.order.labStatus,
            createdAt: p.order.createdAt
          });
        }
        unsentOrders.get(p.order.id).totalPaid += p.amount;
      }
    }
  }

  console.log(`\n--- Ventas cobradas (parcial o total) que aún no fueron enviadas a laboratorio ---`);
  if (unsentOrders.size === 0) {
    console.log("No hay ventas cobradas sin enviar a laboratorio.");
  } else {
    for (const [id, data] of unsentOrders.entries()) {
      console.log(`• Cliente: ${data.clientName} | Pagado: $${data.totalPaid.toLocaleString('es-AR')} | Estado Lab: ${data.labStatus} | Creada: ${data.createdAt.toISOString().slice(0, 10)}`);
    }
  }

  // What are all the possible labStatus values?
  const allLabStatuses = await prisma.order.findMany({
    where: { orderType: 'SALE' },
    select: { labStatus: true },
    distinct: ['labStatus']
  });
  console.log(`\nPosibles estados de laboratorio encontrados en BD:`, allLabStatuses.map(l => l.labStatus));

  await prisma.$disconnect();
}

main().catch(console.error);
