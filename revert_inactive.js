const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const namesToDisable = [
    "test",
    "TL5217 C2",
    "TL5217 C5",
    "TL5217 C4",
    "57202LJH-C1"
  ];
  
  // also check for "Stellest - Control Miopia Airwear" or "Lentes de sol"
  
  const webProducts = await prisma.webProduct.findMany({
    include: { product: true }
  });
  
  for (const wp of webProducts) {
    const name = wp.name || wp.product?.name || "";
    const model = wp.product?.model || "";
    const brand = wp.product?.brand || "";
    
    if (
      name.toLowerCase().includes("prueba") || 
      name.toLowerCase().includes("test") ||
      model.toLowerCase().includes("test") ||
      name.includes("Stellest") ||
      name === "Lentes de sol" ||
      model.includes("TL5217 C2") ||
      model.includes("TL5217 C5") ||
      model.includes("TL5217 C4") ||
      model.includes("57202LJH-C1") ||
      name.includes("Leda C2") ||
      name.includes("Leda C5") ||
      name.includes("Leda C4") ||
      name.includes("Polaris C1")
    ) {
      await prisma.webProduct.update({
        where: { id: wp.id },
        data: { isActive: false }
      });
      console.log(`Re-disabled: ${name} (Model: ${model})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
