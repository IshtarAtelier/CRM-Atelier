const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.$queryRawUnsafe(`
    SELECT "id", "createdAt", "total"
    FROM "Order"
    WHERE "total" = 301542
  `);

  console.log(JSON.stringify(orders, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
