const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
async function main() {
  const crystals = await prisma.product.findMany({ where: { category: 'Cristal' }, take: 5, select: { name: true, unitType: true } });
  console.log(crystals);
}
main().finally(() => prisma.$disconnect());
