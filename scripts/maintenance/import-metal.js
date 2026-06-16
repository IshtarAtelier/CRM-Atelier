const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:localpassword@localhost:5432/atelier?schema=public';
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

const sourceDir = '/Users/ishtarpissano/Pagina web atelier/Receta Fem/Metal';
const targetDir = path.join(process.cwd(), 'public', 'assets', 'products', 'metal');

async function run() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.avif') || f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`Found ${files.length} files to import.`);

  for (const file of files) {
    const sourceFile = path.join(sourceDir, file);
    const targetFile = path.join(targetDir, file);
    
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Copied ${file}`);

    let searchStr = file.replace('.avif', '').replace('.jpg', '').replace('.png', '').trim();
    const baseModel = searchStr.split('-')[0].trim();
    
    const products = await prisma.product.findMany({
      where: {
        model: { contains: baseModel, mode: 'insensitive' }
      },
      include: { webProducts: true }
    });

    let matchedProduct = products.find(p => p.model.replace(/\s+/g, '-').toLowerCase() === searchStr.toLowerCase());
    
    if (!matchedProduct && products.length > 0) {
        matchedProduct = products.find(p => p.model.toLowerCase().replace(/[^a-z0-9]/g, '') === searchStr.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }

    if (!matchedProduct && products.length === 1) {
        matchedProduct = products[0];
    }

    if (matchedProduct) {
      const publicUrl = `/assets/products/metal/${file}`;
      
      let newCatImgs = Array.isArray(matchedProduct.imagenesCatalogo) ? [...matchedProduct.imagenesCatalogo] : [];
      if (!newCatImgs.includes(publicUrl)) {
        newCatImgs.unshift(publicUrl);
      }

      await prisma.product.update({
        where: { id: matchedProduct.id },
        data: { imagenesCatalogo: newCatImgs }
      });

      if (matchedProduct.webProducts && matchedProduct.webProducts.length > 0) {
        const wp = matchedProduct.webProducts[0];
        let newWebImgs = Array.isArray(wp.images) ? [...wp.images] : [];
        if (!newWebImgs.includes(publicUrl)) {
          newWebImgs.unshift(publicUrl);
        }
        await prisma.webProduct.update({
          where: { id: wp.id },
          data: { images: newWebImgs }
        });
      }
      console.log(`   -> Linked to Product ID: ${matchedProduct.id} (Model: ${matchedProduct.model})`);
    } else {
      console.log(`   -> No single matching product found for ${searchStr} (Found ${products.length} partial matches)`);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
