const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const webProducts = await prisma.webProduct.findMany({
    include: {
      product: true
    }
  });

  console.log(`Total WebProduct entries: ${webProducts.length}`);
  const active = webProducts.filter(w => w.isActive);
  const inactive = webProducts.filter(w => !w.isActive);
  console.log(`- Active storefront products: ${active.length}`);
  console.log(`- Inactive storefront products: ${inactive.length}`);

  console.log("\nList of ACTIVE web products:");
  active.forEach(w => {
    console.log(`- ID: ${w.id} | Name: ${w.name} | Category: ${w.category} | Product ID: ${w.productId} | Product Model: ${w.product?.model} | Brand: ${w.product?.brand}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
