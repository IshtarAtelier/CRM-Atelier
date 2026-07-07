const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const webProducts = await prisma.webProduct.findMany({
    include: {
      product: {
        select: {
          name: true,
          brand: true,
          model: true,
          publishToWeb: true,
        }
      }
    }
  });

  const inactive = webProducts.filter(p => !p.isActive);
  const unfeatured = webProducts.filter(p => !p.isFeatured);
  const inactiveAndUnfeatured = webProducts.filter(p => !p.isActive && !p.isFeatured);

  console.log(`Total web products: ${webProducts.length}`);
  console.log(`Inactive products (Habilitar en Tienda = OFF): ${inactive.length}`);
  console.log(`Unfeatured products (Destacar = OFF): ${unfeatured.length}`);
  console.log(`Both OFF: ${inactiveAndUnfeatured.length}`);

  if (inactive.length > 0) {
    console.log("\nSome Inactive Products:");
    inactive.slice(0, 10).forEach(p => console.log(`- ${p.product.name} (Brand: ${p.product.brand}, Model: ${p.product.model})`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
