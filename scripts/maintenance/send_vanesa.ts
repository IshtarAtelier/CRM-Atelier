import { PrismaClient } from '@prisma/client';
import { BotService } from './src/services/bot.service';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

async function main() {
  const order = await prisma.order.findUnique({
    where: { id: 'cmpym50nr000tv0dl2d9g5nhw' },
    include: {
      client: true,
      items: { include: { product: true } },
      payments: true,
      prescription: true
    }
  });

  if (order) {
    console.log("Found order, sending message...");
    const res = await BotService.notifyOrderReady(order);
    console.log("Result:", res);
  } else {
    console.log("Order not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
