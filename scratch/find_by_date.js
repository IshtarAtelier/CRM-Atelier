const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const from = new Date('2026-04-18T00:00:00Z');
  const to = new Date('2026-04-18T23:59:59Z');

  const orders = await prisma.$queryRawUnsafe(`
    SELECT o."id", o."createdAt", o."total", c."name" as "clientName"
    FROM "Order" o
    JOIN "Client" c ON o."clientId" = c.id
    WHERE o."createdAt" >= '2026-04-18' AND o."createdAt" < '2026-04-19'
    AND o."isDeleted" = false
  `);

  console.log(JSON.stringify(orders, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
