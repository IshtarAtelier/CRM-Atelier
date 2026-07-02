const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.webProduct.updateMany({
    data: {
      isActive: true,
      isFeatured: false,
    }
  });
  console.log(`Successfully updated ${result.count} WebProducts.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
