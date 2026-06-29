const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Auditing DB Product Images ===");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      type: true,
      rawImageUrls: true,
      imagenesCatalogo: true,
      webProducts: {
        select: {
          id: true,
          imageUrl: true,
          images: true
        }
      }
    }
  });

  console.log(`Loaded ${products.length} products from the database.`);

  const publicDir = path.join(__dirname, '../../public');

  products.forEach((p, idx) => {
    // We only care about products that have category containing Receta, Sol, or Armazón
    const cat = p.category.toLowerCase();
    const isFrameOrSun = cat.includes('receta') || cat.includes('sol') || cat.includes('armazón') || cat.includes('armazon');
    if (!isFrameOrSun) return;

    console.log(`\n[${idx + 1}] Product: "${p.name}" (ID: ${p.id}) | Category: ${p.category}`);
    console.log(`  - rawImageUrls: ${JSON.stringify(p.rawImageUrls)}`);
    console.log(`  - imagenesCatalogo: ${JSON.stringify(p.imagenesCatalogo)}`);

    if (p.webProducts && p.webProducts.length > 0) {
      p.webProducts.forEach(wp => {
        console.log(`  - WebProduct ID: ${wp.id}`);
        console.log(`    * imageUrl: ${wp.imageUrl}`);
        console.log(`    * images: ${JSON.stringify(wp.images)}`);
        
        // Verify image files on disk
        if (wp.imageUrl) {
          const fullPath = path.join(publicDir, wp.imageUrl.startsWith('/') ? wp.imageUrl.substring(1) : wp.imageUrl);
          const exists = fs.existsSync(fullPath);
          console.log(`    * imageUrl exists on disk: ${exists ? "YES" : "NO"} (${fullPath})`);
        } else {
          console.log(`    * imageUrl is empty`);
        }
      });
    } else {
      console.log(`  - No associated WebProduct record`);
    }
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
