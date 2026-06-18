const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({
    where: { category: 'Cristal' }
  });
  console.log(products.map(p => ({id: p.id, name: p.name})));
}
main().catch(console.error).finally(() => prisma.$disconnect());
