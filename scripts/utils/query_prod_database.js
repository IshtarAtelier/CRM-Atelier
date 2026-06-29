const { PrismaClient } = require('@prisma/client');

// Connect using the production database URL
const prodDbUrl = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDbUrl
    }
  }
});

async function main() {
  console.log("Connecting to production database...");
  
  const totalCount = await prisma.product.count();
  const publishedCount = await prisma.product.count({ where: { publishToWeb: true } });
  
  console.log(`Production Database Statistics:`);
  console.log(`- Total products in production DB: ${totalCount}`);
  console.log(`- Published to web (publishToWeb: true): ${publishedCount}`);

  // Query all published products in production database
  const publishedProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true
    },
    select: {
      brand: true,
      model: true,
      name: true,
      stock: true,
      price: true,
      gender: true
    },
    orderBy: [
      { brand: 'asc' },
      { model: 'asc' }
    ]
  });

  console.log(`\nAll ${publishedProducts.length} published products in production DB:\n`);
  
  // Group by brand
  const grouped = {};
  publishedProducts.forEach(p => {
    const brand = p.brand || 'No Brand';
    if (!grouped[brand]) {
      grouped[brand] = [];
    }
    grouped[brand].push(p);
  });

  Object.keys(grouped).forEach(brand => {
    console.log(`--- BRAND: ${brand} (${grouped[brand].length} products) ---`);
    grouped[brand].forEach(p => {
      console.log(`- Model: ${p.model} | Name: ${p.name} | Gender: ${p.gender} | Stock: ${p.stock} | Price: ${p.price}`);
    });
    console.log();
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Connection failed:", e);
  await prisma.$disconnect();
});
