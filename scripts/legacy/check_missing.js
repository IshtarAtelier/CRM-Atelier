const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany({
    where: { OR: [ { name: { contains: 'GS7015S' } }, { model: { contains: 'GS7015S' } } ] }
  });
  console.log("Found matches for GS7015S:", prods.map(p => ({name: p.name, model: p.model, stock: p.stock})));
}
main().catch(console.error).finally(() => prisma.$disconnect());
