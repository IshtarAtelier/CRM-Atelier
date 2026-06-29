const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allProducts = await prisma.product.findMany({
    select: {
      id: true,
      brand: true,
      model: true,
      name: true,
      gender: true,
      type: true,
      category: true,
      stock: true,
      publishToWeb: true
    }
  });

  console.log(`Analyzing all ${allProducts.length} database products...`);

  // Let's analyze and group
  const groups = {
    'Mujer Metal': [],
    'Mujer Acetato': [],
    'Hombre Metal': [],
    'Other': []
  };

  allProducts.forEach(p => {
    const brandStr = p.brand || '';
    const modelStr = p.model || '';
    const nameStr = p.name || '';
    const genderStr = (p.gender || '').toUpperCase();
    const typeStr = (p.type || '').toUpperCase();
    const catStr = (p.category || '').toUpperCase();

    // Check classification
    const isMujer = genderStr.includes('MUJER') || genderStr.includes('FEMALE') || nameStr.toUpperCase().includes('MUJER');
    const isHombre = genderStr.includes('HOMBRE') || genderStr.includes('MALE') || nameStr.toUpperCase().includes('HOMBRE');
    const isMetal = typeStr.includes('METAL') || catStr.includes('METAL') || nameStr.toUpperCase().includes('METAL') || modelStr.toUpperCase().includes('METAL');
    const isAcetato = typeStr.includes('ACETATO') || catStr.includes('ACETATO') || nameStr.toUpperCase().includes('ACETATO') || modelStr.toUpperCase().includes('ACETATO');

    if (isMujer && isMetal) {
      groups['Mujer Metal'].push(p);
    } else if (isMujer && isAcetato) {
      groups['Mujer Acetato'].push(p);
    } else if (isHombre && isMetal) {
      groups['Hombre Metal'].push(p);
    } else {
      groups['Other'].push(p);
    }
  });

  Object.keys(groups).forEach(groupName => {
    if (groupName === 'Other') return;
    const items = groups[groupName];
    console.log(`\n=========================================`);
    console.log(`${groupName} (${items.length} items in DB)`);
    console.log(`=========================================`);
    
    const published = items.filter(i => i.publishToWeb);
    const unpublished = items.filter(i => !i.publishToWeb);
    
    console.log(`- Published: ${published.length}`);
    console.log(`- Unpublished: ${unpublished.length}`);
    
    console.log(`\nDetails of all items in this group:`);
    items.forEach(i => {
      console.log(`  - Brand: ${i.brand} | Model: ${i.model} | Name: ${i.name} | Gender: ${i.gender} | Type: ${i.type} | Stock: ${i.stock} | Published: ${i.publishToWeb}`);
    });
  });

  await prisma.$disconnect();
}

main().catch(console.error);
