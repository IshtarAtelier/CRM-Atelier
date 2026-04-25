import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
  const products = await prisma.product.findMany({
    select: {
      brand: true,
      laboratory: true,
      lensIndex: true,
    }
  });

  const brands = new Set();
  const labs = new Set();
  const indices = new Set();

  products.forEach(p => {
    if (p.brand) brands.add(p.brand.trim());
    if (p.laboratory) labs.add(p.laboratory.trim());
    if (p.lensIndex) indices.add(p.lensIndex.trim());
  });

  console.log('--- BRANDS ---');
  console.dir(Array.from(brands), { maxArrayLength: null });

  console.log('--- LABORATORIES ---');
  console.dir(Array.from(labs), { maxArrayLength: null });

  console.log('--- INDICES ---');
  console.dir(Array.from(indices), { maxArrayLength: null });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
