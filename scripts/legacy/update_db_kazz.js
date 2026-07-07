const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: 'cmr2v1p8u000lh8aj24vbz4uh' }
  });
  const newImages = [...(p.imagenesCatalogo || []), "/images/products/tryon-g5959-c1.jpg"];
  await prisma.product.update({
    where: { id: 'cmr2v1p8u000lh8aj24vbz4uh' },
    data: { imagenesCatalogo: newImages }
  });
  console.log("Updated product cmr2v1p8u000lh8aj24vbz4uh with new images:", newImages);
}
main().catch(console.error).finally(() => prisma.$disconnect());
