const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: 'cmqbq2bqx005ikrnfkl2qb4b9' }
  });
  const newImages = [...(p.imagenesCatalogo || []), "/assets/products/acetato/tryon-Q5205-c2.jpg"];
  await prisma.product.update({
    where: { id: 'cmqbq2bqx005ikrnfkl2qb4b9' },
    data: { imagenesCatalogo: newImages }
  });
  console.log("Updated product cmqbq2bqx005ikrnfkl2qb4b9 with new images:", newImages);
}
main().catch(console.error).finally(() => prisma.$disconnect());
