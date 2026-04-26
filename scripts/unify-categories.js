const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando unificación de categorías en la base de datos conectada...');
  
  const result = await prisma.product.updateMany({
    where: { category: { in: ['LENS', 'Cristal', 'cristal', 'Lens', 'lens'] } },
    data: { category: 'CRISTAL' }
  });
  
  console.log(`Migración completada. Se unificaron ${result.count} productos a la categoría CRISTAL.`);
}

main()
  .catch(e => {
    console.error('Error durante la unificación:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
