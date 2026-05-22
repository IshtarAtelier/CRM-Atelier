const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway"
    }
  }
});

async function main() {
  try {
    const products = await prisma.product.findMany({
      where: {
        category: 'Cristal'
      },
      select: {
        id: true,
        name: true,
        category: true,
        type: true,
        brand: true,
        model: true,
        price: true,
        cost: true,
        lensIndex: true,
        laboratory: true
      }
    });

    console.log(`Found ${products.length} crystals in production db.`);
    if (products.length > 0) {
      console.log("Sample crystals:", products.slice(0, 5));
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
