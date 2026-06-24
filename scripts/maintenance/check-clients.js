const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const ids = ['cmqr0iy8j000uxusvhbpbfy24', 'cmqr2nb3d00021klwfdu50g1g'];
  for (const id of ids) {
    const client = await prisma.client.findUnique({ where: { id } });
    console.log(`Client ${id}: ${client ? 'FOUND (' + client.name + ')' : 'NOT FOUND'}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
