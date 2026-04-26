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
  
  let count = 0;
  for (const p of products) {
    const fields = [p.name, p.category, p.type, p.brand, p.model, p.lensIndex, p.laboratory];
    if (fields.some(f => f && f.toLowerCase().includes('multifocal') && f !== 'Cristal Multifocal')) {
      console.log(`Found product ${p.id} with multifocal in some field:`, p);
      count++;
    }
  }
  
  console.log(`Total found: ${count}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
