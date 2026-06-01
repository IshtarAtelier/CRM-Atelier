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
  const products = await prisma.product.findMany();
  
  let incomplete = [];
  
  for (const p of products) {
    let missing = [];
    if (!p.name) missing.push('name');
    if (!p.category) missing.push('category');
    if (!p.type) missing.push('type');
    
    // Only check lensIndex, brand, and laboratory for Crystals
    if (p.category === 'Cristal' || p.category === 'Lente de Contacto' || (p.type && p.type.includes('Cristal'))) {
       if (!p.lensIndex) missing.push('lensIndex');
       if (!p.brand) missing.push('brand');
       if (!p.laboratory) missing.push('laboratory');
    }
    
    if (p.price === undefined || p.price === null) missing.push('price');
    if (p.cost === undefined || p.cost === null) missing.push('cost');
    
    if (missing.length > 0) {
      incomplete.push({ id: p.id, name: p.name, category: p.category, missing });
    }
  }
  
  const fs = require('fs');
  fs.writeFileSync('all_incomplete_products.json', JSON.stringify({
    totalChecked: products.length,
    incompleteCount: incomplete.length,
    incomplete
  }, null, 2));
  
  console.log(`Report generated. Total: ${products.length}, Incomplete: ${incomplete.length}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
