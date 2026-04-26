import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "postgresql://postgres:rPSyETnmDeqAUqKGIEHEUmcbSALAi@interchange.proxy.rlwy.net:12579/railway";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'Sygnus', mode: 'insensitive' }
    }
  });
  
  console.log(`Found ${products.length} Sygnus products`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
