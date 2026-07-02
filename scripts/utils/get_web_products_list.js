const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all published products
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { publishToWeb: true },
        { brand: { contains: 'clip on', mode: 'insensitive' } },
        { brand: { contains: 'clipon', mode: 'insensitive' } },
        { category: { contains: 'clip on', mode: 'insensitive' } },
        { category: { contains: 'clipon', mode: 'insensitive' } }
      ]
    },
    select: {
      brand: true,
      model: true,
      stock: true,
      publishToWeb: true,
      category: true
    },
    orderBy: [
      { brand: 'asc' },
      { model: 'asc' }
    ]
  });

  const fs = require('fs');
  let md = `# Productos en la Web y Clip-ons\n\n`;
  md += `Total de productos encontrados: ${products.length}\n\n`;
  md += `| Marca | Modelo | Categoría | Stock | Web |\n`;
  md += `|---|---|---|---|---|\n`;

  products.forEach(p => {
    md += `| ${p.brand || '-'} | ${p.model || '-'} | ${p.category || '-'} | ${p.stock || 0} | ${p.publishToWeb ? 'Sí' : 'No'} |\n`;
  });

  const path = require('path');
  const outFile = path.join(process.env.ARTIFACTS_DIR || '.', 'productos_web_clipones.md');
  fs.writeFileSync(outFile, md);
  console.log("Written to", outFile);
  await prisma.$disconnect();
}

main().catch(console.error);
