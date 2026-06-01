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
      brand: null,
      OR: [
        { category: 'Cristal' },
        { category: 'Lente de Contacto' },
        { type: { contains: 'Cristal', mode: 'insensitive' } }
      ]
    }
  });
  
  if (products.length === 0) {
    console.log("No products found to update.");
    return;
  }

  console.log(`Found ${products.length} products to update brands...`);
  
  let updatedCount = 0;
  for (const p of products) {
    const name = (p.name || '').toUpperCase();
    let assignedBrand = null;
    
    if (name.includes('KODAK')) {
      assignedBrand = 'Kodak';
    } else if (name.includes('COMFORT') || name.includes('PHYSIO')) {
      assignedBrand = 'Varilux';
    } else if (name.includes('EYEZEN') || name.includes('MYOPILUX') || name.includes('INTERVIEW') || name.includes('ESPACE')) {
      assignedBrand = 'Essilor';
    } else if (name.includes('TRANSITIONS') && name.startsWith('TRANSITIONS')) {
      assignedBrand = 'Transitions';
    }
    
    if (assignedBrand) {
      await prisma.product.update({
        where: { id: p.id },
        data: { brand: assignedBrand }
      });
      updatedCount++;
      console.log(`Updated: ${p.name} -> Brand: ${assignedBrand}`);
    } else {
      console.log(`Skipped (could not determine brand): ${p.name}`);
    }
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
