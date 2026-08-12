// ────────────────────────────────────────────────────────────────────────────
// Embudo de "Oportunidades de Cierre": cuenta cuántos candidatos hay en la base
// y qué filtro de /api/sales-opportunities descarta a cada uno. Para diagnosticar
// el panel vacío sin adivinar.
//
// SOLO LEE. Corre contra la base que diga OPORTUNIDADES_DB_URL (pensado para
// producción vía PROD_DATABASE_URL) o, si no está, contra DATABASE_URL (local).
//
// Correr:  OPORTUNIDADES_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//            scripts/checks/oportunidades-funnel.check.mjs
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.OPORTUNIDADES_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const prisma = new PrismaClient({ datasources: { db: { url } } });

console.log(`\n— Embudo de Oportunidades de Cierre (base: ${esProd ? 'PRODUCCIÓN' : 'local'}) —\n`);

// Los mismos umbrales que la ruta
const q = async (sql) => (await prisma.$queryRawUnsafe(sql));
const n = async (sql) => Number((await q(sql))[0].c);

// ── Fuente 2: presupuestos fríos (la principal para "no compraron aún") ─────
console.log('PRESUPUESTOS (Order.orderType=QUOTE):');
console.log(`  creados en los últimos 45 días (total):        ${await n(`
  SELECT count(*) c FROM "Order" WHERE "orderType"='QUOTE' AND "isDeleted"=false
   AND "createdAt" > now() - interval '45 days'`)}`);
console.log(`  ...con 3-45 días de edad (ventana del panel):   ${await n(`
  SELECT count(*) c FROM "Order" WHERE "orderType"='QUOTE' AND "isDeleted"=false
   AND "createdAt" < now() - interval '3 days' AND "createdAt" > now() - interval '45 days'`)}`);
console.log(`  ...y status PENDING/CONFIRMED:                  ${await n(`
  SELECT count(*) c FROM "Order" WHERE "orderType"='QUOTE' AND "isDeleted"=false
   AND "createdAt" < now() - interval '3 days' AND "createdAt" > now() - interval '45 days'
   AND status IN ('PENDING','CONFIRMED')`)}`);
console.log('  status de los presupuestos de la ventana (todos):');
for (const r of await q(`
  SELECT status, count(*) c FROM "Order" WHERE "orderType"='QUOTE' AND "isDeleted"=false
   AND "createdAt" < now() - interval '3 days' AND "createdAt" > now() - interval '45 days'
   GROUP BY status ORDER BY c DESC`)) {
  console.log(`    ${String(r.status).padEnd(14)} ${r.c}`);
}

// Embudo fila por fila sobre los PENDING/CONFIRMED de la ventana
const filas = await q(`
  SELECT o.id, o.total, o."createdAt", o.status,
         c.id AS client_id, c.name, c.status AS client_status,
         c."opportunityDismissedAt", c."isDeleted" AS client_deleted,
         EXISTS (SELECT 1 FROM "Order" o2 WHERE o2."clientId" = c.id AND o2."isDeleted"=false
                 AND (o2."orderType"='SALE' OR (o2.status='CONFIRMED' AND o2."updatedAt" > now() - interval '7 days'))
                ) AS ya_compro,
         EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o.id AND (
                   abs(coalesce(i."sphereVal",0)) >= 4 OR abs(coalesce(i."cylinderVal",0)) >= 2
                   OR i."additionVal" IS NOT NULL
                   OR lower(concat(i."productBrandSnapshot",' ',i."productNameSnapshot",' ',i."productCategorySnapshot"))
                      ~ '(multifocal|progresivo|bifocal|myofix|myopilux|myolens|miop)'
                )) AS ticket_especial
    FROM "Order" o JOIN "Client" c ON c.id = o."clientId"
   WHERE o."orderType"='QUOTE' AND o."isDeleted"=false
     AND o."createdAt" < now() - interval '3 days' AND o."createdAt" > now() - interval '45 days'
     AND o.status IN ('PENDING','CONFIRMED')`);

const motivos = {};
const vivos = [];
for (const f of filas) {
  const motivo =
    f.client_deleted                                      ? 'cliente borrado' :
    ['CLIENT','active'].includes(f.client_status)         ? `cliente ya con status ${f.client_status}` :
    f.ya_compro                                           ? 'el cliente ya tiene una VENTA (o confirmada reciente)' :
    (f.opportunityDismissedAt && f.createdAt < f.opportunityDismissedAt) ? 'descartado con el check ✓ del panel' :
    (Number(f.total) < 250000 && !f.ticket_especial)      ? `ticket bajo ($${Number(f.total).toLocaleString('es-AR')} < $250.000 y sin ticket especial)` :
    null;
  if (motivo) motivos[motivo] = (motivos[motivo] || 0) + 1;
  else vivos.push(f);
}
console.log('\n  Por qué se descarta cada uno:');
for (const [m, c] of Object.entries(motivos).sort((a,b)=>b[1]-a[1])) console.log(`    ${String(c).padStart(3)} × ${m}`);
console.log(`\n  ⇒ SOBREVIVEN al embudo de presupuestos: ${vivos.length}`);
for (const v of vivos.slice(0, 10)) {
  console.log(`     · ${v.name} — $${Number(v.total).toLocaleString('es-AR')} — ${Math.floor((Date.now()-new Date(v.createdAt))/86400000)} días — ${v.status}`);
}

// ── Fuente 1: favoritos ──────────────────────────────────────────────────────
console.log(`\nFAVORITOS: marcados y no borrados:               ${await n(`
  SELECT count(*) c FROM "Client" WHERE "isFavorite"=true AND "isDeleted"=false`)}`);
console.log(`  ...sin status CLIENT/active y sin venta:        ${await n(`
  SELECT count(*) c FROM "Client" c WHERE "isFavorite"=true AND "isDeleted"=false
   AND c.status NOT IN ('CLIENT','active') AND c."opportunityDismissedAt" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."clientId"=c.id AND o."isDeleted"=false
                   AND (o."orderType"='SALE' OR (o.status='CONFIRMED' AND o."updatedAt" > now() - interval '7 days')))`)}`);

// ── Fuente 3: carritos ───────────────────────────────────────────────────────
console.log(`\nCARRITOS (CheckoutSession PENDING/ABANDONED, 1-45 días):`);
for (const r of await q(`
  SELECT status, count(*) c, count(*) FILTER (WHERE total >= 250000) c_altos
    FROM "CheckoutSession"
   WHERE status IN ('PENDING','ABANDONED')
     AND "createdAt" < now() - interval '24 hours' AND "createdAt" > now() - interval '45 days'
   GROUP BY status`)) {
  console.log(`  ${String(r.status).padEnd(10)} ${r.c} (de los cuales ≥$250.000: ${r.c_altos})`);
}

// ── La definición del usuario: sin comprar + ≤30 días + ticket alto ─────────
console.log(`\nCON LA DEFINICIÓN PEDIDA (sin comprar, ≤30 días, ticket alto):`);
console.log(`  presupuestos que entrarían:                     ${await n(`
  SELECT count(*) c FROM "Order" o JOIN "Client" c2 ON c2.id=o."clientId"
   WHERE o."orderType"='QUOTE' AND o."isDeleted"=false AND c2."isDeleted"=false
     AND o."createdAt" > now() - interval '30 days'
     AND (o.total >= 250000 OR EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id AND (
          abs(coalesce(i."sphereVal",0)) >= 4 OR abs(coalesce(i."cylinderVal",0)) >= 2 OR i."additionVal" IS NOT NULL
          OR lower(concat(i."productBrandSnapshot",' ',i."productNameSnapshot",' ',i."productCategorySnapshot"))
             ~ '(multifocal|progresivo|bifocal|myofix|myopilux|myolens|miop)')))
     AND NOT EXISTS (SELECT 1 FROM "Order" o2 WHERE o2."clientId"=c2.id AND o2."isDeleted"=false
                     AND o2."orderType"='SALE' AND o2."createdAt" > o."createdAt")`)}`);

await prisma.$disconnect();
console.log('');
