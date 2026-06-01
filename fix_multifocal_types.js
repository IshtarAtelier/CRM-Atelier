const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

async function main() {
  const products = await prisma.product.findMany({
    where: {
      type: null,
      OR: [
        { name: { contains: 'COMFORT', mode: 'insensitive' } },
        { name: { contains: 'PHYSIO', mode: 'insensitive' } }
      ]
    }
  });
  
  if (products.length === 0) {
    console.log("No products found to update.");
    return;
  }

  console.log(`Found ${products.length} products to update. Updating type to 'Cristal Multifocal'...`);
  
  let updatedCount = 0;
  for (const p of products) {
    await prisma.product.update({
      where: { id: p.id },
      data: { type: 'Cristal Multifocal' }
    });
    updatedCount++;
    console.log(`Updated: ${p.name}`);
  }
  
  console.log(`Successfully updated ${updatedCount} products.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
