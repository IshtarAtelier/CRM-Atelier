const path = require('path');
const { PrismaClient } = require(path.resolve(process.cwd(), 'prisma/generated/client'));

const prisma = new PrismaClient();

async function getLabs() {
  try {
    const products = await prisma.product.findMany({
      where: { laboratory: { not: null } },
      select: { laboratory: true },
      distinct: ['laboratory']
    });
    console.log("Laboratorios actuales:", products.map(p => p.laboratory).filter(Boolean));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
getLabs();
