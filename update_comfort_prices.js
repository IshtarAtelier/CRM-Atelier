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
      name: {
        contains: 'COMFORT -', // Specifically target COMFORT - and ignore COMFORT MAX -
      }
    }
  });
  
  if (products.length === 0) {
    console.log("No COMFORT products found to update.");
    return;
  }

  console.log(`Found ${products.length} COMFORT products to update prices...`);
  
  let updatedCount = 0;
  for (const p of products) {
    const name = (p.name || '').toUpperCase();
    
    // Ignore MAX explicitly just in case
    if (name.includes('MAX')) continue;

    let baseCost = null;
    
    if (name.includes('ORMA') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 321175;
    } else if (name.includes('AIRWEAR') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 361110;
    } else if (name.includes('STYLIS') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 386655;
    } else if (name.includes('ORMA') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 483635;
    } else if (name.includes('AIRWEAR') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 522960;
    } else if (name.includes('STYLIS') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 551105;
    }
    
    if (baseCost) {
      const finalCost = Math.round((baseCost + 46000) * 1.21);
      const finalPrice = Math.round(finalCost * 2.4);
      
      await prisma.product.update({
        where: { id: p.id },
        data: { 
          cost: finalCost,
          price: finalPrice
        }
      });
      updatedCount++;
      console.log(`Updated: ${p.name} -> Base: ${baseCost}, Cost: ${finalCost}, Price: ${finalPrice}`);
    } else {
      console.log(`Skipped (could not determine base cost): ${p.name}`);
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
