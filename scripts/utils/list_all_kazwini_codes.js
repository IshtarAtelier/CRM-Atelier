const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const SCRATCH_DIR = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch';
const OUTPUT_TXT = path.join(SCRATCH_DIR, 'all_catalog_codes.txt');

async function main() {
  const products = await prisma.product.findMany({
    where: {
      brand: {
        in: ['Lindberg', 'Acetato top', 'Kazwini', 'kazwini', 'Hang Loose', 'Hango loose', 'Clip On', 'Clip on'],
        mode: 'insensitive'
      }
    },
    orderBy: [
      { brand: 'asc' },
      { model: 'asc' }
    ],
    select: {
      brand: true,
      model: true,
      stock: true,
      cost: true
    }
  });

  console.log(`Extracted ${products.length} products from the database.`);

  let fileContent = `LIST OF ALL KAZWINI PRODUCT CODES IN CRM CATALOG (${products.length} total):\n\n`;
  
  // Group by brand
  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.brand]) {
      grouped[p.brand] = [];
    }
    grouped[p.brand].push(p);
  });

  Object.keys(grouped).forEach(brand => {
    fileContent += `=========================================\n`;
    fileContent += `BRAND: ${brand.toUpperCase()} (${grouped[brand].length} products)\n`;
    fileContent += `=========================================\n`;
    grouped[brand].forEach(p => {
      fileContent += `- Model Code: ${p.model} | Stock: ${p.stock} | Cost: ${p.cost} USD\n`;
    });
    fileContent += `\n`;
  });

  // Ensure directory exists
  if (!fs.existsSync(SCRATCH_DIR)) {
    fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_TXT, fileContent);
  console.log(`Saved full list to: ${OUTPUT_TXT}`);

  // Also print a condensed summary to console for the agent to show
  console.log("\n--- SUMMARY OF MODELS AND VARIANTS ---");
  Object.keys(grouped).forEach(brand => {
    console.log(`\nBrand: ${brand} (${grouped[brand].length} variants)`);
    // Group variants by base model code to keep it short
    const baseModels = {};
    grouped[brand].forEach(p => {
      const parts = p.model.split(/\s+/);
      const color = parts[parts.length - 1];
      const base = parts.slice(0, -1).join(' ') || p.model;
      if (!baseModels[base]) {
        baseModels[base] = [];
      }
      baseModels[base].push(color);
    });

    Object.keys(baseModels).forEach(base => {
      console.log(`  - Model: ${base} | Variants: [${baseModels[base].join(', ')}]`);
    });
  });

  await prisma.$disconnect();
}

main().catch(console.error);
