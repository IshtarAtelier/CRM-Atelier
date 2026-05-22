import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const frame = await prisma.product.create({
    data: {
      name: "Armazón de Prueba Payway",
      category: "Armazón",
      type: "Prueba",
      brand: "Atelier",
      model: "TEST-01",
      stock: 100,
      price: 1.0,
      publishToWeb: true,
      customSlug: "test-armazon",
      imagenesCatalogo: ["/images/products/atelier-9030-gold.png"]
    }
  });

  const lens = await prisma.product.create({
    data: {
      name: "Cristal de Prueba Payway",
      category: "Cristal",
      type: "Prueba",
      brand: "Essilor",
      model: "TEST-LENS",
      stock: 100,
      price: 1.0,
      publishToWeb: false,
    }
  });

  console.log("Created frame:", frame.id);
  console.log("Created lens:", lens.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
