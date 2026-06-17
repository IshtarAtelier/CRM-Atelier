const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const o = await prisma.order.findUnique({
    where: { id: 'cmqicjoyg0002bn6k0479a4ec' },
    include: { items: { include: { product: true } } }
  });
  console.log("labMaterial:", o.labMaterial);
  console.log("labColor:", o.labColor);
  console.log("labType:", o.labType);
  console.log("Items:");
  o.items.forEach(i => console.log("- ", i.product ? i.product.name : 'null', i.productNameSnapshot));
}
main().finally(() => prisma.$disconnect());
