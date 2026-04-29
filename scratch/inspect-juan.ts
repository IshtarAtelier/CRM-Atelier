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
  const clientName = "Juan Mario Allasino";
  
  const client = await prisma.client.findFirst({
    where: { name: { contains: "Juan Mario Allasino" } },
    include: {
      orders: {
        include: {
          payments: true
        }
      }
    }
  });

  if (!client) {
    console.log("Client not found");
    return;
  }

  console.log(`Found client: ${client.name} (ID: ${client.id})`);
  
  for (const order of client.orders) {
    console.log(`Order ID: ${order.id} | Type: ${order.orderType} | Total: ${order.total} | Paid: ${order.paid} | CreatedAt: ${order.createdAt}`);
    for (const payment of order.payments) {
      console.log(`  -> Payment ID: ${payment.id} | Amount: ${payment.amount} | Method: ${payment.method}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
