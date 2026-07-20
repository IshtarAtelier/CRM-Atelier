/**
 * Revisa items ACTIVOS de la tienda sin costo (cost = 0/null) y les asigna 15.000.
 * --dry solo lista, sin escribir.
 *   PROD: DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/asignar_costo_faltante.js [--dry]
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const NUEVO_COSTO = 15000;

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  console.log(`\n🎯 ${host} ${!/localhost/.test(host) ? '⚠️ PROD' : '(local)'} ${DRY ? '· DRY' : ''}\n`);

  const rows = await prisma.webProduct.findMany({ where: { isActive: true }, include: { product: true } });
  const sinCosto = rows.filter((r) => !r.product || r.product.cost == null || r.product.cost === 0);

  console.log(`Items activos: ${rows.length} · sin costo: ${sinCosto.length}`);
  const byCat = {};
  sinCosto.forEach((r) => (byCat[r.category] = (byCat[r.category] || 0) + 1));
  console.log('por categoría:', JSON.stringify(byCat), '\n');

  sinCosto.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  for (const r of sinCosto) {
    console.log(`  [${r.category}] ${r.name.padEnd(24)} precio=${r.product ? r.product.price : '—'}`);
  }

  if (!DRY) {
    let n = 0;
    for (const r of sinCosto) {
      if (!r.product) continue;
      await prisma.product.update({ where: { id: r.product.id }, data: { cost: NUEVO_COSTO } });
      n++;
    }
    console.log(`\n✅ ${n} items actualizados a cost=${NUEVO_COSTO} en ${host}`);
  } else {
    console.log(`\nDRY: se asignaría cost=${NUEVO_COSTO} a ${sinCosto.length} items.`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
