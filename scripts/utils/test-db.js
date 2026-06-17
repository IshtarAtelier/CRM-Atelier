const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.findFirst();
  console.log(admin ? 'DB OK' : 'DB empty');
}
main().catch(console.error).finally(() => prisma.$disconnect());
