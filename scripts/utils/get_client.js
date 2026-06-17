const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.client.findUnique({
    where: { id: 'cmqiagi720000xz5qt34r0edv' }
  });
  console.log(c);
}
main().finally(() => prisma.$disconnect());
