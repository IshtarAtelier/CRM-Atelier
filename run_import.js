const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();
async function main() {
  const tag = await p.tag.findUnique({ where: { name: 'Ya es cliente' } });
  const c = await p.client.create({
    data: {
      name: 'Gabriela Testoni',
      phone: '543512050531',
      email: 'gabytestoni@hotmail.com',
      contactSource: 'Importado',
      status: 'active',
      tags: { connect: { id: tag.id } }
    }
  });
  console.log('Restored:', c.name, c.id);
}
main().finally(() => p.$disconnect());
