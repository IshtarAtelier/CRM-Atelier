const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  const products = await prisma.product.findMany({
    where: { model: { contains: '5959' } }
  });
  
  for (const p of products) {
     console.log(`ID: ${p.id}, Model: ${p.model}, Images: ${JSON.stringify(p.imagenesCatalogo)}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
