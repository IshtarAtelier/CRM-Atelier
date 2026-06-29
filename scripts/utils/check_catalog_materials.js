const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      gender: {
        in: ['Femenino', 'Masculino']
      }
    },
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

  console.log(`Found ${products.length} products with gender Femenino or Masculino in DB.\n`);

  // Let's filter by categories:
  // 1. Mujer Acetato
  // 2. Mujer Metal
  // 3. Hombre Metal
  
  const groups = {
    'Mujer Acetato': [],
    'Mujer Metal': [],
    'Hombre Metal': [],
    'Others': []
  };

  products.forEach(p => {
    const brandStr = (p.brand || '').toUpperCase();
    const modelStr = (p.model || '').toUpperCase();
    const nameStr = (p.name || '').toUpperCase();
    const gender = p.gender; // Femenino or Masculino

    const isMujer = gender === 'Femenino';
    const isHombre = gender === 'Masculino';
    
    // We check model/name/brand for material cues
    const isMetal = nameStr.includes('METAL') || modelStr.includes('METAL') || brandStr.includes('METAL') || brandStr.includes('TITANIO') || nameStr.includes('TITANIO');
    const isAcetato = nameStr.includes('ACETATO') || modelStr.includes('ACETATO') || brandStr.includes('ACETATO');

    if (isMujer && isAcetato) {
      groups['Mujer Acetato'].push(p);
    } else if (isMujer && isMetal) {
      groups['Mujer Metal'].push(p);
    } else if (isHombre && isMetal) {
      groups['Hombre Metal'].push(p);
    } else {
      groups['Others'].push(p);
    }
  });

  Object.keys(groups).forEach(groupName => {
    const list = groups[groupName];
    console.log(`\n=========================================`);
    console.log(`${groupName} (${list.length} variants in DB)`);
    console.log(`=========================================`);
    
    const published = list.filter(p => p.publishToWeb);
    console.log(`- Published: ${published.length}`);
    console.log(`- Total: ${list.length}`);

    // Print up to 15 examples
    const samples = list.slice(0, 15);
    if (samples.length > 0) {
      console.log(`Samples:`);
      samples.forEach(s => {
        console.log(`  * Brand: ${s.brand} | Model: ${s.model} | Stock: ${s.stock} | Published: ${s.publishToWeb}`);
      });
      if (list.length > 15) {
        console.log(`  * ... and ${list.length - 15} more`);
      }
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);
