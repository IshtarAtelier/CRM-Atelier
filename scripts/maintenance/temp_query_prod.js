const { PrismaClient } = require('@prisma/client');

// Use the production database URL from the environment config
const prodUrl = process.env.PROD_DATABASE_URL || "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodUrl
    }
  }
});

const models = [
  'M7011 C4', 'M7027 C4', 'M7033 C1', 'M7033 C2', 'M7237 C1',
  'M7237 C2', 'M7239 C4', 'TL3704A C4', 'TL3704A C5', 'TL3932 C2',
  'TL5206 C4', 'TL5207 C4', 'TL5208 C2', 'TL5213 C4', 'TL5217 C4'
];

async function check() {
  console.log('--- VERIFYING PRODUCTS IN PRODUCTION DB ---');
  const products = await prisma.product.findMany({
    where: {
      model: { in: models },
      brand: 'Atelier'
    }
  });

  console.log(`Found ${products.length} of these models in production database.`);
  products.forEach(p => {
    console.log(`Model: ${p.model} | Name: ${p.name} | Price: ${p.price} | Stock: ${p.stock}`);
  });
}

check().catch(console.error).finally(() => prisma.$disconnect());
