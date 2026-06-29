const { PrismaClient } = require('@prisma/client');

const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

async function main() {
  const webProducts = await prisma.webProduct.findMany({
    include: {
      product: true
    }
  });

  console.log(`Total WebProduct entries in production DB: ${webProducts.length}`);
  const active = webProducts.filter(w => w.isActive);
  const inactive = webProducts.filter(w => !w.isActive);
  console.log(`- Active: ${active.length}`);
  console.log(`- Inactive: ${inactive.length}`);

  // Let's group active by brand
  const activeByBrand = {};
  active.forEach(w => {
    const brand = w.product?.brand || 'Atelier';
    activeByBrand[brand] = (activeByBrand[brand] || 0) + 1;
  });

  console.log("\nActive WebProducts by brand:");
  Object.keys(activeByBrand).forEach(b => {
    console.log(`- ${b}: ${activeByBrand[b]} active products`);
  });

  console.log("\nInactive WebProducts by brand:");
  const inactiveByBrand = {};
  inactive.forEach(w => {
    const brand = w.product?.brand || 'Atelier';
    inactiveByBrand[brand] = (inactiveByBrand[brand] || 0) + 1;
  });
  Object.keys(inactiveByBrand).forEach(b => {
    console.log(`- ${b}: ${inactiveByBrand[b]} inactive products`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
