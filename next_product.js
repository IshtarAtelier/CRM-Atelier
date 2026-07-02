const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, model: true, imagenesCatalogo: true }
  });
  
  const withOneImage = products.filter(p => p.imagenesCatalogo && p.imagenesCatalogo.length === 1);
  if (withOneImage.length > 0) {
    console.log("Next product:");
    console.log(withOneImage[0]);
  } else {
    console.log("No products with 1 image left.");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
