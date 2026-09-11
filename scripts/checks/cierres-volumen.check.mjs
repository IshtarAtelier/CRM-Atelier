// ────────────────────────────────────────────────────────────────────────────
// ¿Cuántas tarjetas tendría Oportunidades de Cierre con cada ventana?
//
// Para calibrar el panel a lo que un vendedor puede cubrir (Ishtar, 10/9/2026:
// "tiempos abarcables por un vendedor"). Cuenta, por ventana de días, los
// presupuestos (todos y solo ticket alto), los carritos abandonados y las
// fichas que nunca recibieron presupuesto — ya deduplicados por persona
// (ficha / teléfono / email), igual que la ruta.
//
// SOLO LEE. Corre contra OPORTUNIDADES_DB_URL o, si falta, DATABASE_URL.
//   OPORTUNIDADES_DB_URL="$PROD_DATABASE_URL" node --env-file=.env --experimental-strip-types \
//     --import ./scripts/checks/_alias.mjs scripts/checks/cierres-volumen.check.mjs
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.OPORTUNIDADES_DB_URL || process.env.DATABASE_URL;
const esProd = !/localhost|127\.0\.0\.1/.test(url || '');
const prisma = new PrismaClient({ datasources: { db: { url } } });

const DIA = 86400000;
const hace = (d) => new Date(Date.now() - d * DIA);
const TAGS_NO_CLIENTE = ['no cliente', 'proveedor', 'laboratorio', 'mayorista'];
const SOLO_POSIBLES = { tags: { none: { OR: TAGS_NO_CLIENTE.map((n) => ({ name: { contains: n, mode: 'insensitive' } })) } } };
const ESPECIALES = ['multifocal', 'progresivo', 'bifocal', 'myofix', 'myopilux', 'myolens', 'miopía', 'miopia', 'control miop'];

const tel = (p) => {
  let b = (p || '').replace(/\D/g, '');
  if (b.startsWith('549')) b = b.slice(3); else if (b.startsWith('54')) b = b.slice(2);
  if (b.startsWith('0')) b = b.slice(1);
  if (b.length > 10) { const m = b.match(/^([1-3]\d{1,3})15(\d{6,8})$/); if (m) b = m[1] + m[2]; }
  return b.length >= 8 ? b.slice(-8) : null;
};

console.log(`\n— Volumen de Oportunidades de Cierre (base: ${esProd ? 'PRODUCCIÓN' : 'local'}) —\n`);

// Personas que ya compraron (para la exclusión, como la ruta).
const compradores = await prisma.client.findMany({
  where: { isDeleted: false, OR: [{ status: { in: ['CLIENT', 'active'] } }, { orders: { some: { orderType: 'SALE', isDeleted: false } } }] },
  select: { phone: true, email: true },
});
const telCompra = new Set(compradores.map((c) => tel(c.phone)).filter(Boolean));
const mailCompra = new Set(compradores.map((c) => c.email?.trim().toLowerCase()).filter(Boolean));
const yaCompro = (o) => (o.pk && telCompra.has(o.pk)) || (o.ek && mailCompra.has(o.ek));

// 1. Presupuestos
const quotes = await prisma.order.findMany({
  where: { orderType: 'QUOTE', status: { in: ['PENDING', 'CONFIRMED'] }, isDeleted: false, createdAt: { lt: hace(3), gt: hace(30) },
    client: { isDeleted: false, status: { notIn: ['CLIENT', 'active'] }, ...SOLO_POSIBLES } },
  select: { id: true, total: true, createdAt: true,
    client: { select: { id: true, phone: true, email: true, opportunityDismissedAt: true,
      orders: { where: { isDeleted: false, orderType: 'SALE' }, select: { createdAt: true } } } },
    items: { select: { sphereVal: true, cylinderVal: true, additionVal: true, productNameSnapshot: true, productBrandSnapshot: true, productCategorySnapshot: true } } },
});
const opsQuote = [];
for (const q of quotes) {
  if (q.client.opportunityDismissedAt && q.createdAt < q.client.opportunityDismissedAt) continue;
  if (q.client.orders.some((o) => o.createdAt > q.createdAt)) continue;
  const alto = q.total >= 250000 || q.items.some((i) =>
    (i.sphereVal != null && Math.abs(i.sphereVal) >= 4) || (i.cylinderVal != null && Math.abs(i.cylinderVal) >= 2) || i.additionVal != null ||
    ESPECIALES.some((k) => `${i.productBrandSnapshot || ''} ${i.productNameSnapshot || ''} ${i.productCategorySnapshot || ''}`.toLowerCase().includes(k)));
  opsQuote.push({ tipo: 'presupuesto', alto, cid: q.client.id, pk: tel(q.client.phone), ek: q.client.email?.trim().toLowerCase() || null, dias: (Date.now() - q.createdAt) / DIA });
}

// 2. Carritos
const carts = await prisma.checkoutSession.findMany({
  // EMAIL_SENT también: es el carrito que ya recibió el mail de recupero y sigue sin pagar.
  where: { status: { in: ['PENDING', 'ABANDONED', 'EMAIL_SENT'] }, createdAt: { lt: hace(1), gt: hace(30) } },
  select: { total: true, createdAt: true, clientId: true, phone: true, email: true, cartData: true },
});
const opsCart = carts.map((c) => {
  const items = Array.isArray(c.cartData) ? c.cartData : [];
  const alto = c.total >= 250000 || items.some((i) => ESPECIALES.some((k) => `${i.brand || ''} ${i.model || ''} ${i.category || ''}`.toLowerCase().includes(k)));
  return { tipo: 'carrito', alto, cid: c.clientId, pk: tel(c.phone), ek: c.email?.trim().toLowerCase() || null, dias: (Date.now() - c.createdAt) / DIA };
});

// 3. Fichas que nunca recibieron presupuesto
const sinPresu = await prisma.client.findMany({
  where: { isDeleted: false, status: { notIn: ['CLIENT', 'active'] }, createdAt: { lt: hace(3), gt: hace(30) },
    opportunityDismissedAt: null, orders: { none: { isDeleted: false } }, ...SOLO_POSIBLES },
  select: { id: true, phone: true, email: true, createdAt: true, contactSource: true },
});
const opsSin = sinPresu.map((c) => ({ tipo: 'sin presupuesto', alto: false, cid: c.id, pk: tel(c.phone), ek: c.email?.trim().toLowerCase() || null, dias: (Date.now() - c.createdAt) / DIA, fuente: c.contactSource || '(sin origen)' }));

const dedup = (ops) => {
  const vistas = new Set(); const out = [];
  for (const o of [...ops].sort((a, b) => (b.alto - a.alto))) {
    const ks = [o.cid && `c:${o.cid}`, o.pk && `t:${o.pk}`, o.ek && `e:${o.ek}`].filter(Boolean);
    if (ks.some((k) => vistas.has(k))) continue;
    out.push(o); ks.forEach((k) => vistas.add(k));
  }
  return out;
};

const todas = [...opsQuote, ...opsCart, ...opsSin].filter((o) => !yaCompro(o));
console.log('Candidatos crudos (antes de deduplicar):', todas.length, ` · se colapsan por duplicado: ${todas.length - dedup(todas).length}\n`);

const fila = (etq, ops) => {
  const u = dedup(ops);
  const c = (t) => u.filter((o) => o.tipo === t).length;
  console.log(`${etq.padEnd(38)} total ${String(u.length).padStart(4)}   presu ${String(c('presupuesto')).padStart(4)}  carrito ${String(c('carrito')).padStart(3)}  sin presu ${String(c('sin presupuesto')).padStart(4)}`);
};

for (const hasta of [7, 10, 14, 21, 30]) {
  const v = todas.filter((o) => o.dias <= hasta);
  console.log(`── Ventana hasta ${hasta} días`);
  fila('  A) solo ticket alto (hoy)', v.filter((o) => o.alto));
  fila('  B) todo presupuesto/carrito', v.filter((o) => o.tipo !== 'sin presupuesto'));
  fila('  C) B + sin presupuesto', v);
}

// ── La regla VIGENTE: el servicio REAL, no una copia. La copia que había acá
// ya divergió una vez (heredó el bug de los carritos EMAIL_SENT) y daba
// números para decidir que no eran los del panel. `oportunidades()` solo lee.
process.env.DATABASE_URL = url;
const { CierresService } = await import('../../src/services/cierres.service.ts');
const panel = await CierresService.oportunidades();
const porTipo = panel.reduce((a, o) => ((a[o.type] = (a[o.type] || 0) + 1), a), {});
console.log('\n── REGLA VIGENTE (lo que muestra el panel hoy)');
console.log(`  ${panel.length} tarjetas · ${JSON.stringify(porTipo)}`);
console.log(`  importantes: ${panel.filter((o) => o.importante).length} (ya escritos, atenuados: ${panel.filter((o) => o.yaEscrito).length})`);
console.log(`  → PARA ESCRIBIR HOY: ${panel.filter((o) => !o.yaEscrito).length}`);

// Entrada diaria: cuántas tarjetas NUEVAS aparecen por día (lo que el vendedor
// tiene que absorber cada mañana), promedio de las últimas 4 semanas.
const nuevasPorDia = (ops) => (dedup(ops).filter((o) => o.dias <= 30).length / 27).toFixed(1);
console.log('\nEntrada diaria promedio (tarjetas nuevas por día):');
console.log(`  A) ticket alto: ${nuevasPorDia(todas.filter((o) => o.alto))}   B) todo presu/carrito: ${nuevasPorDia(todas.filter((o) => o.tipo !== 'sin presupuesto'))}   solo sin presupuesto: ${nuevasPorDia(todas.filter((o) => o.tipo === 'sin presupuesto'))}`);

const porFuente = new Map();
for (const o of dedup(opsSin.filter((o) => !yaCompro(o)))) porFuente.set(o.fuente, (porFuente.get(o.fuente) || 0) + 1);
console.log('\nFichas sin presupuesto (30 días), por origen:');
for (const [f, n] of [...porFuente].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(5)}  ${f}`);

await prisma.$disconnect();
process.exit(0);
