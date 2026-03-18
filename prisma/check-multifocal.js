const { PrismaClient } = require('../prisma/generated/client');
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.product.findMany({
    where: { type: 'Cristal Multifocal' },
    select: { id: true, name: true, price: true, cost: true, brand: true },
    orderBy: { brand: 'asc' }
  });
  console.log('Total multifocales en DB:', products.length);
  products.forEach(p => {
    console.log(`  ${p.brand} | ${p.name} | precio: $${p.price} | costo: $${p.cost}`);
  });
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
