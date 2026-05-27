import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.product.updateMany({
    where: { name: "Armazón de Prueba Payway" },
    data: { category: "Armazón de Receta" }
  });
  console.log("Updated category to Armazón de Receta");
}

main().catch(console.error).finally(() => prisma.$disconnect());
