const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Auditing Product Images ===");

  const products = await prisma.product.findMany({
    where: { isDeleted: false },
    select: {
      id: true,
      code: true,
      name: true,
      image: true,
      gallery: true
    }
  });

  console.log(`Found ${products.length} active products in the database.`);

  const publicDir = path.join(__dirname, '../../public');
  console.log(`Public directory path: ${publicDir}\n`);

  let brokenPrimaryCount = 0;
  let brokenGalleryCount = 0;

  for (const product of products) {
    // 1. Audit primary image
    if (product.image) {
      // Check if it is a relative path
      let relativePath = product.image;
      if (relativePath.startsWith('http')) {
        console.log(`[HTTP LINK] Product "${product.name}" (${product.code}): primary image is an external URL: ${product.image}`);
        brokenPrimaryCount++;
      } else {
        // Remove leading slash if present
        const filePath = path.join(publicDir, relativePath.startsWith('/') ? relativePath.substring(1) : relativePath);
        if (!fs.existsSync(filePath)) {
          console.log(`[MISSING FILE] Product "${product.name}" (${product.code}): primary image file does not exist: ${product.image} (expected at ${filePath})`);
          brokenPrimaryCount++;
        }
      }
    } else {
      console.log(`[NO IMAGE] Product "${product.name}" (${product.code}): no primary image specified.`);
    }

    // 2. Audit gallery images
    if (product.gallery && Array.isArray(product.gallery)) {
      for (const gal of product.gallery) {
        if (gal.startsWith('http')) {
          console.log(`[HTTP LINK] Product "${product.name}" (${product.code}): gallery image is an external URL: ${gal}`);
          brokenGalleryCount++;
        } else {
          const filePath = path.join(publicDir, gal.startsWith('/') ? gal.substring(1) : gal);
          if (!fs.existsSync(filePath)) {
            console.log(`[MISSING FILE] Product "${product.name}" (${product.code}): gallery image file does not exist: ${gal}`);
            brokenGalleryCount++;
          }
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Broken/Missing Primary Images: ${brokenPrimaryCount}`);
  console.log(`Broken/Missing Gallery Images: ${brokenGalleryCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
