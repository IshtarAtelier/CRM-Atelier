import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const orders = await prisma.order.count();
  const clients = await prisma.client.count();
  
  console.log('--- DB STATS ---');
  console.log(`Users: ${users}`);
  console.log(`Orders: ${orders}`);
  console.log(`Clients: ${clients}`);

  if (orders > 0) {
    const recentOrders = await prisma.order.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' },
      include: { client: true }
    });
    console.log('Recent Orders:', JSON.stringify(recentOrders, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
