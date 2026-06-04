// Seed: Monofocal Fotocromático Smart Color 1.56 — GRUPO OPTICO
// Fórmula: (Costo + Calibrado $7.000) × (1 + IVA 0%) × 2.4
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CALIBRADO = 7000;
const IVA = 0; // GRUPO OPTICO no lleva IVA
const MARKUP = 2.4;

const products = [
  {
    brand: 'Smart',
    name: 'Orgánico Fotocromático Smart Color 1.56 - Tallado CNC',
    lensIndex: '1.56',
    cost: 100000,
    // (100000 + 7000) × 1.00 × 2.4 = 256800
  },
  {
    brand: 'Smart',
    name: 'Orgánico Fotocromático Smart Color 1.56 - Tallado Digital',
    lensIndex: '1.56',
    cost: 160000,
    // (160000 + 7000) × 1.00 × 2.4 = 400800
  },
];

async function seed() {
  console.log('\n🔬 Insertando Monofocal Fotocromático Smart Color 1.56...\n');
  console.log(`  Calibrado: $${CALIBRADO.toLocaleString()}`);
  console.log(`  IVA: ${IVA}%`);
  console.log(`  Markup: ×${MARKUP}\n`);

  let created = 0, updated = 0, errors = 0;

  for (const p of products) {
    const costoReal = (p.cost + CALIBRADO) * (1 + IVA / 100);
    const price = Math.round(costoReal * MARKUP);

    try {
      // Check if already exists
      const existing = await prisma.product.findFirst({
        where: { brand: p.brand, name: p.name, category: 'Cristal' }
      });

      const data = {
        name: p.name,
        brand: p.brand,
        category: 'Cristal',
        type: 'Cristal Monofocal',
        lensIndex: p.lensIndex,
        unitType: 'PAR',
        laboratory: 'GRUPO OPTICO',
        price: price,
        cost: p.cost,
        stock: 0,
        sphereMin: -8.0,
        sphereMax: 5.0,
        cylinderMin: -6.0,
        cylinderMax: 0,
      };

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data
        });
        updated++;
        console.log(`  🔄 UPDATED | ${p.name}`);
      } else {
        await prisma.product.create({ data });
        created++;
        console.log(`  ✅ CREATED | ${p.name}`);
      }

      console.log(`     Costo: $${p.cost.toLocaleString()} → Real: $${costoReal.toLocaleString()} → Precio: $${price.toLocaleString()}\n`);
    } catch (e) {
      errors++;
      console.log(`  ❌ ERROR | ${p.name}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`\n✨ Creados: ${created} | Actualizados: ${updated} | Errores: ${errors}`);
  await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
