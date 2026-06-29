const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      model: {
        contains: '57202LJH'
      }
    },
    include: {
      webProducts: true
    }
  });

  console.log(`Found ${products.length} products matching '57202LJH' in the database:\n`);
  products.forEach(p => {
    console.log(`- Product ID: ${p.id}`);
    console.log(`  Model: "${p.model}"`);
    console.log(`  Name: "${p.name}"`);
    console.log(`  PublishToWeb: ${p.publishToWeb}`);
    console.log(`  Stock: ${p.stock}`);
    console.log(`  WebProduct count: ${p.webProducts.length}`);
    if (p.webProducts.length > 0) {
      p.webProducts.forEach(w => {
        console.log(`    * WebProduct ID: ${w.id} | Slug: "${w.slug}" | IsActive: ${w.isActive}`);
      });
    }
    console.log();
  });

  await prisma.$disconnect();
}

main().catch(console.error);
