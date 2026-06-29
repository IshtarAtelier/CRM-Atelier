const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const publishedProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true,
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    },
    select: {
      id: true,
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  console.log(`Found ${publishedProducts.length} published products in the database:\n`);
  publishedProducts.forEach(p => {
    console.log(`- ID: ${p.id} | Brand: ${p.brand} | Model: ${p.model} | Stock: ${p.stock} | Cost: ${p.cost} USD`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
