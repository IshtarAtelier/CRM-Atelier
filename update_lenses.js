const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.product.findMany({
    where: { category: 'Cristal', name: { startsWith: 'Multifocal' } }
  });
  
  let count = 0;
  for (const p of products) {
    const newName = 'Smart - ' + p.name;
    await prisma.product.update({
      where: { id: p.id },
      data: { name: newName }
    });
    count++;
    console.log(`Updated: ${p.name} -> ${newName}`);
  }
  console.log(`Successfully updated ${count} products.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
