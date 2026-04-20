const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    where: {
      name: { contains: 'Julieta', mode: 'insensitive' }
    },
    include: {
      orders: {
        where: { isDeleted: false },
        select: {
          id: true,
          total: true,
          createdAt: true,
          status: true
        }
      }
    }
  });

  console.log(JSON.stringify(clients, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
