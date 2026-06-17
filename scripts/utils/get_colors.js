const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const colors = await prisma.crystalColor.findMany();
  console.log(colors);
}
main().finally(() => prisma.$disconnect());
