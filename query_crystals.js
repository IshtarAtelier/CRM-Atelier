const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const crystals = await prisma.product.findMany({
    where: { category: 'Cristal' },
    select: { name: true, price: true }
  });
  console.log(crystals.filter(c => c.price === 145000 || (c.name.toLowerCase().includes('blue') && c.price > 0)));
}

main().catch(console.error).finally(() => prisma.$disconnect());
