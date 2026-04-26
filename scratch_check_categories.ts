import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  let dbUrl = '';
  const prodDbLine = envConfig.split('\n').find(line => line.startsWith('PROD_DATABASE_URL='));
  if (prodDbLine) {
    dbUrl = prodDbLine.substring('PROD_DATABASE_URL='.length).trim();
    if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
      dbUrl = dbUrl.slice(1, -1);
    } else if (dbUrl.startsWith("'") && dbUrl.endsWith("'")) {
      dbUrl = dbUrl.slice(1, -1);
    }
    process.env.DATABASE_URL = dbUrl;
  }
}

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  
  const typeCounts = products.reduce((acc, p) => {
    acc[p.type || 'null'] = (acc[p.type || 'null'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('All Type counts:', typeCounts);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
