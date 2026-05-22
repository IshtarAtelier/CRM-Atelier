import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'Prueba' } },
    select: { id: true, name: true, category: true, publishToWeb: true, price: true, stock: true, imagenesCatalogo: true, rawImageUrls: true, imageProcessingStatus: true }
  });
  console.log(JSON.stringify(products, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
