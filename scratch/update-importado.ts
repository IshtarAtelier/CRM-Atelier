import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.client.updateMany({
    where: {
      contactSource: 'Importado',
    },
    data: {
      contactSource: 'Ya es Cliente',
    },
  });

  console.log(`Actualizados ${result.count} clientes de 'Importado' a 'Ya es Cliente'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
