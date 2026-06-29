const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allKazwiniProducts = await prisma.product.findMany({
    where: {
      brand: {
        in: ['Lindberg', 'Acetato top', 'Kazwini', 'kazwini', 'Hang Loose', 'Hango loose', 'Clip On', 'Clip on'],
        mode: 'insensitive'
      }
    },
    select: {
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  console.log(`Total Kazwini products in CRM catalog: ${allKazwiniProducts.length}`);
  
  // Group by brand
  const brandCounts = {};
  allKazwiniProducts.forEach(p => {
    const b = p.brand;
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });

  console.log("Counts by brand:");
  Object.keys(brandCounts).forEach(b => {
    console.log(`- ${b}: ${brandCounts[b]} products`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
