const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const totalCount = await prisma.product.count();
  const publishedCount = await prisma.product.count({ where: { publishToWeb: true } });
  const unpublishedCount = await prisma.product.count({ where: { publishToWeb: false } });
  
  // Count by brand where brand is not Atelier
  const nonAtelierCount = await prisma.product.count({
    where: {
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    }
  });

  const nonAtelierPublished = await prisma.product.count({
    where: {
      publishToWeb: true,
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    }
  });

  const nonAtelierUnpublished = await prisma.product.count({
    where: {
      publishToWeb: false,
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    }
  });

  console.log("Database Product Statistics:");
  console.log(`- Total products in DB: ${totalCount}`);
  console.log(`- Total published to web (publishToWeb: true): ${publishedCount}`);
  console.log(`- Total unpublished to web (publishToWeb: false): ${unpublishedCount}`);
  console.log(`- Non-Atelier (imported/Kazwini) total: ${nonAtelierCount}`);
  console.log(`- Non-Atelier (imported/Kazwini) published: ${nonAtelierPublished}`);
  console.log(`- Non-Atelier (imported/Kazwini) unpublished: ${nonAtelierUnpublished}`);

  // Let's print some examples of unpublished non-Atelier products to see their stocks
  const sampleUnpublished = await prisma.product.findMany({
    where: {
      publishToWeb: false,
      NOT: {
        brand: {
          equals: 'Atelier',
          mode: 'insensitive'
        }
      }
    },
    take: 10,
    select: {
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  console.log("\nSample of unpublished non-Atelier products:");
  sampleUnpublished.forEach(p => {
    console.log(`- Brand: ${p.brand} | Model: ${p.model} | Stock: ${p.stock} | Cost: ${p.cost} USD`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
