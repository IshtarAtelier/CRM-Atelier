const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: {
        contains: 'COMFORT',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      type: true
    }
  });
  console.log(products);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
