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
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { brand: { contains: 'kodak', mode: 'insensitive' } },
        { name: { contains: 'kodak', mode: 'insensitive' } },
        { model: { contains: 'kodak', mode: 'insensitive' } },
        { laboratory: { contains: 'kodak', mode: 'insensitive' } },
      ]
    }
  });
  
  console.log(`Found ${products.length} Kodak products`);
  for (const p of products) {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Category: ${p.category}, Type: ${p.type}, Brand: ${p.brand}, Lab: ${p.laboratory}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
