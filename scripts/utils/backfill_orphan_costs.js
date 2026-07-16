/**
 * Recupera el costo perdido en líneas de venta huérfanas (producto borrado ANTES del
 * trigger de blindaje del 14/7, cuando todavía no se congelaba el costo).
 *
 * Qué hace: busca OrderItems con productId NULL y productCostSnapshot NULL pero CON
 * nombre congelado, y matchea ese nombre+marca(+categoría) contra los productos VIVOS
 * del catálogo (el caso típico: se borró un duplicado y sobrevive un gemelo con el
 * mismo nombre). Si el match es inequívoco, copia su `cost` a productCostSnapshot.
 *
 * Reglas de seguridad del match:
 *  - Solo escribe si TODOS los productos vivos que matchean tienen el MISMO costo
 *    (si hay dos gemelos con costos distintos → ambiguo, se reporta y no se toca).
 *  - Solo rellena productCostSnapshot cuando está NULL; jamás pisa un costo existente.
 *  - El costo se copia tal cual (para cristales es POR PAR, igual que al vender:
 *    los reportes ya dividen por ojo con `item.eye ? cost/2 : cost`).
 *
 * DRY por defecto (solo informa). Para escribir agregar --commit:
 *   LOCAL informe:   node scripts/utils/backfill_orphan_costs.js
 *   PROD informe:    DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/backfill_orphan_costs.js
 *   PROD escribir:   DATABASE_URL="$PROD_DATABASE_URL" node scripts/utils/backfill_orphan_costs.js --commit
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');

const norm = (s) => (s || '').trim().toLowerCase();

async function main() {
  const host = (process.env.DATABASE_URL || '').replace(/.*@/, '').replace(/\/.*/, '');
  const isProd = !/localhost|127\.0\.0\.1/.test(host);
  console.log(`\n🎯 ${host || '(sin host)'} ${isProd ? '⚠️  PROD' : '(local)'} · ${COMMIT ? 'COMMIT (escribe)' : 'DRY (solo informa)'}\n`);

  const orphans = await prisma.orderItem.findMany({
    where: { productId: null, productCostSnapshot: null, productNameSnapshot: { not: null } },
    select: {
      id: true, quantity: true, price: true, eye: true,
      productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true,
      order: { select: { id: true, orderType: true, createdAt: true, isDeleted: true } },
    },
  });
  console.log(`Líneas huérfanas sin costo (con nombre): ${orphans.length}`);
  if (orphans.length === 0) { await prisma.$disconnect(); return; }

  const products = await prisma.product.findMany({
    select: { id: true, name: true, model: true, brand: true, category: true, cost: true },
  });

  // Índice de productos vivos por nombre normalizado (name y model apuntan al mismo producto)
  const byName = new Map();
  for (const p of products) {
    for (const key of new Set([norm(p.name), norm(p.model)])) {
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(p);
    }
  }

  const matched = [];   // { item, cost, via }
  const ambiguous = []; // { item, costs }
  const unmatched = [];

  for (const it of orphans) {
    const candidates = byName.get(norm(it.productNameSnapshot)) || [];
    // Refino por marca si la línea la tiene y algún candidato coincide
    let pool = candidates;
    if (it.productBrandSnapshot) {
      const brandPool = candidates.filter((p) => norm(p.brand) === norm(it.productBrandSnapshot));
      if (brandPool.length > 0) pool = brandPool;
    }
    // Refino por categoría con la misma lógica
    if (it.productCategorySnapshot) {
      const catPool = pool.filter((p) => norm(p.category) === norm(it.productCategorySnapshot));
      if (catPool.length > 0) pool = catPool;
    }

    const withCost = pool.filter((p) => p.cost != null);
    if (withCost.length === 0) { unmatched.push(it); continue; }

    const costs = [...new Set(withCost.map((p) => p.cost))];
    if (costs.length > 1) { ambiguous.push({ item: it, costs }); continue; }
    matched.push({ item: it, cost: costs[0], via: withCost[0] });
  }

  console.log(`\n✅ Matcheadas (costo único e inequívoco): ${matched.length}`);
  console.log(`⚠️  Ambiguas (gemelos con costos distintos): ${ambiguous.length}`);
  console.log(`❌ Sin match en el catálogo vivo:            ${unmatched.length}\n`);

  for (const m of matched) {
    const o = m.item.order;
    console.log(`  ✅ ${o.createdAt.toISOString().slice(0, 10)} ${o.orderType}${o.isDeleted ? ' (borrada)' : ''} · "${m.item.productNameSnapshot}" [${m.item.productBrandSnapshot || '-'}] → cost $${m.cost.toLocaleString('es-AR')} (de ${m.via.id})`);
  }
  if (ambiguous.length) {
    console.log('');
    for (const a of ambiguous) {
      console.log(`  ⚠️  "${a.item.productNameSnapshot}" [${a.item.productBrandSnapshot || '-'}] → costos posibles: ${a.costs.map((c) => `$${c.toLocaleString('es-AR')}`).join(' / ')}`);
    }
  }
  if (unmatched.length) {
    console.log('');
    const grouped = {};
    for (const u of unmatched) {
      const k = `"${u.productNameSnapshot}" [${u.productBrandSnapshot || '-'}]`;
      grouped[k] = (grouped[k] || 0) + 1;
    }
    for (const [k, n] of Object.entries(grouped)) console.log(`  ❌ ${k} ×${n}`);
  }

  if (!COMMIT) {
    console.log('\nDRY: no se escribió nada. Para aplicar: --commit');
  } else {
    let written = 0;
    for (const m of matched) {
      // updateMany con doble condición: nunca pisa un costo que apareció entre el scan y el write
      const r = await prisma.orderItem.updateMany({
        where: { id: m.item.id, productCostSnapshot: null },
        data: { productCostSnapshot: m.cost },
      });
      written += r.count;
    }
    console.log(`\n✍️  Escritas ${written}/${matched.length} líneas.`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
