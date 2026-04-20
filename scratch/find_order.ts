import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    include: {
      client: true
    },
    where: {
      isDeleted: false
    }
  });

  const matchingOrders = orders.filter(o => 
    o.id.toLowerCase().endsWith('h4zd') || 
    (o.client && o.client.name.includes('Julieta'))
  );

  console.log(JSON.stringify(matchingOrders, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
