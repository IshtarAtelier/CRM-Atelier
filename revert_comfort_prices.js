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
        contains: 'COMFORT -', 
      }
    }
  });
  
  if (products.length === 0) {
    console.log("No COMFORT products found to update.");
    return;
  }

  console.log(`Reverting ${products.length} COMFORT products to the 3rd column prices...`);
  
  let updatedCount = 0;
  for (const p of products) {
    const name = (p.name || '').toUpperCase();
    
    // Ignore MAX explicitly just in case
    if (name.includes('MAX')) continue;

    let baseCost = null;
    
    // Using 3rd column from the image:
    if (name.includes('ORMA') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 405875;
    } else if (name.includes('AIRWEAR') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 445810;
    } else if (name.includes('STYLIS') && !name.includes('TRANSITIONS') && !name.includes('XPERIO')) {
      baseCost = 471355;
    } else if (name.includes('ORMA') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 568335;
    } else if (name.includes('AIRWEAR') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 607660;
    } else if (name.includes('STYLIS') && (name.includes('TRANSITIONS') || name.includes('XPERIO'))) {
      baseCost = 635805;
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
      console.log(`Reverted: ${p.name} -> Base: ${baseCost}, Cost: ${finalCost}, Price: ${finalPrice}`);
    } else {
      console.log(`Skipped (could not determine base cost): ${p.name}`);
    }
  }
  
  console.log(`Successfully reverted ${updatedCount} products.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
