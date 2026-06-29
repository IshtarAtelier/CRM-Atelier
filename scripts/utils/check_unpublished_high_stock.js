const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      stock: {
        gte: 20
      },
      publishToWeb: false
    },
    select: {
      id: true,
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  console.log(`Found ${products.length} products with stock >= 20 that have publishToWeb: false:\n`);
  products.forEach(p => {
    console.log(`- ID: ${p.id} | Brand: ${p.brand} | Model: ${p.model} | Stock: ${p.stock} | Cost: ${p.cost}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
