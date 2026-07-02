const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  const products = await prisma.product.findMany({
    where: { modelCode: { contains: '5959' } }
  });
  
  if (products.length === 0) {
    const products2 = await prisma.product.findMany({
      where: { model: { contains: '5959' } }
    });
    console.log("Found by model:", products2.map(p => p.id + " - " + p.model));
  } else {
    console.log("Found by modelCode:", products.map(p => p.id + " - " + p.model));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
