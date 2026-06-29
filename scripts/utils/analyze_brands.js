const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.product.groupBy({
    by: ['brand'],
    _count: {
      id: true
    }
  });

  console.log("All Brands count in DB:");
  for (const b of brands) {
    const brandName = b.brand || 'No Brand';
    const total = b._count.id;
    const published = await prisma.product.count({
      where: {
        brand: b.brand,
        publishToWeb: true
      }
    });
    const maxStock = await prisma.product.findFirst({
      where: { brand: b.brand },
      orderBy: { stock: 'desc' },
      select: { stock: true }
    });
    console.log(`- Brand: "${brandName}" | Total in DB: ${total} | Published to Web: ${published} | Max Stock in DB: ${maxStock?.stock || 0}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
