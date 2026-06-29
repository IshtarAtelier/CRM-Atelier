const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      gender: true,
      type: true,
      category: true
    }
  });

  const genders = new Set();
  const types = new Set();
  const categories = new Set();

  products.forEach(p => {
    if (p.gender) genders.add(p.gender);
    if (p.type) types.add(p.type);
    if (p.category) categories.add(p.category);
  });

  console.log("Distinct Genders in DB:", Array.from(genders));
  console.log("Distinct Types in DB:", Array.from(types));
  console.log("Distinct Categories in DB:", Array.from(categories));

  // Let's also print 10 sample products to see their details
  const samples = await prisma.product.findMany({
    take: 10,
    select: {
      brand: true,
      model: true,
      name: true,
      gender: true,
      type: true,
      category: true
    }
  });
  console.log("\nSample Products:");
  samples.forEach(s => {
    console.log(`- Brand: ${s.brand} | Model: ${s.model} | Name: ${s.name} | Gender: ${s.gender} | Type: ${s.type} | Category: ${s.category}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
