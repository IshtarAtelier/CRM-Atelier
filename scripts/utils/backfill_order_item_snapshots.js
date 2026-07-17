/**
 * Backfill de la "foto" (snapshot) faltante en las líneas de venta (OrderItem).
 *
 * Rellena productNameSnapshot / productBrandSnapshot / productCategorySnapshot /
 * productCostSnapshot / laboratorySnapshot en las líneas que apuntan a un producto vivo
 * pero quedaron SIN foto (ventas anteriores a que existieran esas columnas). Después de
 * esto, borrar cualquier producto conserva en el histórico qué se vendió y a qué costo,
 * y desaparece el "margen inflado" (costo 0) en los reportes.
 *
 * DRY por defecto (solo informa, no escribe). Para escribir agregar --commit:
 *   LOCAL informe:   node scripts/utils/backfill_order_item_snapshots.js
 *   LOCAL escribir:  node scripts/utils/backfill_order_item_snapshots.js --commit
 *   PROD (con OK):   DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/backfill_order_item_snapshots.js --commit
 *
 * Misma lógica que snapshotFromProduct() de src/lib/order-snapshot.ts, replicada acá porque
 * los scripts corren en node plano, sin los alias de TypeScript.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

function snapshotFromProduct(p) {
  return {
    productNameSnapshot: p.model || p.name || null,
    productBrandSnapshot: p.brand || null,
    productCategorySnapshot: p.category || null,
    productCostSnapshot: p.cost != null ? p.cost : 0,
    laboratorySnapshot: p.laboratory || null,
    productTypeSnapshot: p.type || null,
    productLensIndexSnapshot: p.lensIndex || null,
    productUnitTypeSnapshot: p.unitType || null,
    productOriginSnapshot: p.origin || null,
  };
}

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 ${host || '(sin host)'} ${isProd ? '⚠️  PROD' : '(local)'} · ${COMMIT ? 'COMMIT (escribe)' : 'DRY (solo informa)'}\n`);

  // 1. Líneas sin foto pero todavía vinculadas a un producto → recuperables.
  const missing = await prisma.orderItem.findMany({
    where: { productId: { not: null }, productNameSnapshot: null },
    select: { productId: true },
  });

  // 2. Líneas ya sin foto y sin producto → irrecuperables (el producto ya no existe). Solo se reportan.
  const orphanNoSnapshot = await prisma.orderItem.count({
    where: { productId: null, productNameSnapshot: null },
  });

  console.log(`Líneas recuperables (sin foto, con producto vivo): ${missing.length}`);
  console.log(`Líneas sin foto y sin producto (irrecuperables):    ${orphanNoSnapshot}`);

  if (missing.length === 0) {
    console.log('\n✅ Nada para rellenar: todas las líneas con producto ya tienen su foto.');
    await prisma.$disconnect();
    return;
  }

  // Contar líneas por producto (para no filtrar en cada vuelta).
  const countById = new Map();
  for (const m of missing) countById.set(m.productId, (countById.get(m.productId) || 0) + 1);
  const productIds = [...countById.keys()];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, model: true, name: true, brand: true, category: true, cost: true, laboratory: true, type: true, lensIndex: true, unitType: true, origin: true },
  });
  const foundIds = new Set(products.map((p) => p.id));

  // Productos referenciados que ya no existen (dangling): no se pueden recuperar.
  const danglingCount = productIds.filter((id) => !foundIds.has(id)).reduce((s, id) => s + countById.get(id), 0);
  if (danglingCount) {
    console.log(`⚠️  ${danglingCount} líneas apuntan a productos inexistentes (no recuperables).`);
  }

  // Muestra de lo que se rellenaría.
  console.log('\nMuestra:');
  for (const p of products.slice(0, 15)) {
    const snap = snapshotFromProduct(p);
    console.log(`  ${(snap.productBrandSnapshot || '').padEnd(14)} ${(snap.productNameSnapshot || '').padEnd(24)} costo=${String(snap.productCostSnapshot).padStart(8)} · ${countById.get(p.id)} línea(s)`);
  }

  let updated = 0;
  if (COMMIT) {
    for (const p of products) {
      const res = await prisma.orderItem.updateMany({
        where: { productId: p.id, productNameSnapshot: null },
        data: snapshotFromProduct(p),
      });
      updated += res.count;
    }
    console.log(`\n✅ ${updated} líneas de venta actualizadas con su foto en ${host}.`);
  } else {
    updated = products.reduce((s, p) => s + countById.get(p.id), 0);
    console.log(`\nDRY: se rellenarían ${updated} líneas. Corré con --commit para escribir.`);
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
