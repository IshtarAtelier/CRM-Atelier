const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const webProductsInactive = await prisma.webProduct.count({ where: { isActive: false } });
  const webProductsFeatured = await prisma.webProduct.count({ where: { isFeatured: true } });
  const productsNotPublished = await prisma.product.count({ where: { publishToWeb: false } });
  
  console.log(`WebProducts Inactivos (Habilitar en Tienda = OFF): ${webProductsInactive}`);
  console.log(`WebProducts Destacados (Destacar Producto = ON): ${webProductsFeatured}`);
  console.log(`Products no publicados a web (publishToWeb = OFF): ${productsNotPublished}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
