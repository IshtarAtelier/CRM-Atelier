// Reporte SOLO LECTURA de uso del sistema del día (Milena y Matías) contra prod.
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '/Users/ishtarpissano/proyectos/atelier/.env' });

const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Ventana: hoy en horario de Argentina (UTC-3)
const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;
const now = new Date();
const argNow = new Date(now.getTime() - ARG_OFFSET_MS);
const startArg = new Date(Date.UTC(argNow.getUTCFullYear(), argNow.getUTCMonth(), argNow.getUTCDate(), 0, 0, 0));
const start = new Date(startArg.getTime() + ARG_OFFSET_MS); // instante UTC del 00:00 ART
const end = now;

const hs = (d) => new Date(d.getTime() - ARG_OFFSET_MS).toISOString().slice(11, 16);
const short = (id) => (id ? id.slice(-4).toUpperCase() : '?');

async function main() {
  console.log('VENTANA:', start.toISOString(), '->', end.toISOString(), '(hoy ART)');

  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
  console.log('\n=== USUARIOS ===');
  users.forEach(u => console.log(`${u.id} | ${u.name} | ${u.email} | ${u.role}`));

  // 1) AuditLog
  const audits = await prisma.auditLog.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true, userName: true, action: true, entityType: true, entityId: true, details: true, createdAt: true },
  });
  console.log(`\n=== AUDITLOG (${audits.length} eventos hoy) ===`);
  const byUser = {};
  audits.forEach(a => {
    const k = a.userName || '(sin nombre)';
    byUser[k] = byUser[k] || [];
    byUser[k].push(a);
  });
  Object.entries(byUser).sort((a, b) => b[1].length - a[1].length).forEach(([name, list]) => {
    const counts = {};
    list.forEach(a => { const k = `${a.action} ${a.entityType}`; counts[k] = (counts[k] || 0) + 1; });
    console.log(`\n-- ${name}: ${list.length} eventos (${hs(list[0].createdAt)} → ${hs(list[list.length - 1].createdAt)})`);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${v}x ${k}`));
  });

  console.log('\n=== AUDITLOG DETALLE (cronológico) ===');
  audits.forEach(a => {
    let det = '';
    try { det = a.details ? JSON.stringify(a.details).slice(0, 220) : ''; } catch { }
    console.log(`${hs(a.createdAt)} | ${a.userName} | ${a.action} ${a.entityType} ${a.entityId} | ${det}`);
  });

  // 2) Interacciones (notas en fichas)
  const inters = await prisma.interaction.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    select: { userName: true, type: true, content: true, createdAt: true, directedToName: true, client: { select: { name: true } } },
  });
  console.log(`\n=== INTERACCIONES/NOTAS (${inters.length}) ===`);
  inters.forEach(i => console.log(`${hs(i.createdAt)} | ${i.userName || '(s/d)'} | ${i.type} | ${i.client?.name || ''}${i.directedToName ? ` → para ${i.directedToName}` : ''} | ${(i.content || '').replace(/\s+/g, ' ').slice(0, 140)}`));

  // 3) Pagos cargados
  const pays = await prisma.payment.findMany({
    where: { date: { gte: new Date(start.getTime() - 36 * 60 * 60 * 1000) } },
    orderBy: { date: 'asc' },
    select: { createdByName: true, amount: true, method: true, date: true, order: { select: { id: true, client: { select: { name: true } } } } },
  });
  console.log(`\n=== PAGOS (${pays.length}) ===`);
  pays.forEach(p => console.log(`${p.date.toISOString()} (raw) | ${hs(p.date)} ART | ${p.createdByName || '(s/d)'} | $${p.amount} | ${p.method} | pedido ${short(p.order?.id)} | ${p.order?.client?.name || ''}`));

  // 3bis) Los pagos que el AuditLog dice que se crearon hoy (Payment.date es fecha-only,
  // así que la ventana por `date` no alcanza para saber quién cargó qué durante el día)
  const payIds = audits.filter(a => a.action === 'CREATE' && a.entityType === 'PAYMENT').map(a => a.entityId);
  const paysToday = await prisma.payment.findMany({
    where: { id: { in: payIds } },
    select: { id: true, date: true, amount: true, method: true, createdByName: true, order: { select: { id: true, total: true, client: { select: { name: true } } } } },
  });
  console.log(`\n=== PAGOS CARGADOS HOY (AuditLog: ${payIds.length}; vivos en DB: ${paysToday.length}) ===`);
  const auditById = Object.fromEntries(audits.map(a => [a.entityId, a]));
  paysToday.forEach(p => console.log(`${hs(auditById[p.id].createdAt)} | ${p.createdByName || '(s/d)'} | $${p.amount} | ${p.method} | pedido ${short(p.order?.id)} | ${p.order?.client?.name || ''} | fecha del pago: ${p.date.toISOString().slice(0, 10)}`));
  payIds.filter(id => !paysToday.some(p => p.id === id)).forEach(id => console.log(`${hs(auditById[id].createdAt)} | ${auditById[id].userName} | (BORRADO después) ${JSON.stringify(auditById[id].details).slice(0, 160)}`));

  // 4) Pedidos creados hoy y enviados a fábrica hoy
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, total: true, status: true, labSentBy: true, labSentAt: true, user: { select: { name: true } }, client: { select: { name: true } } },
  });
  console.log(`\n=== PEDIDOS CREADOS HOY (${orders.length}) ===`);
  orders.forEach(o => console.log(`${hs(o.createdAt)} | #${short(o.id)} | alta: ${o.user?.name || '(s/d)'} | ${o.client?.name || ''} | $${o.total} | ${o.status}${o.labSentBy ? ` | a fábrica: ${o.labSentBy}` : ''}`));

  const sent = await prisma.order.findMany({
    where: { labSentAt: { gte: start, lte: end } },
    orderBy: { labSentAt: 'asc' },
    select: { id: true, labSentAt: true, labSentBy: true, labSentById: true, total: true, user: { select: { name: true } }, client: { select: { name: true } } },
  });
  console.log(`\n=== ENVIADOS A FÁBRICA HOY / VENTAS (${sent.length}) ===`);
  sent.forEach(o => console.log(`${hs(o.labSentAt)} | #${short(o.id)} | labSentBy=${o.labSentBy || 'null'} | labSentById=${o.labSentById || 'null'} | user=${o.user?.name || '(s/d)'} | ${o.client?.name || ''} | $${o.total}`));

  // 5) Tareas completadas
  const tasks = await prisma.clientTask.findMany({
    where: { completedAt: { gte: start, lte: end } },
    orderBy: { completedAt: 'asc' },
    select: { completedBy: true, completedAt: true, description: true, status: true, client: { select: { name: true } } },
  });
  console.log(`\n=== TAREAS COMPLETADAS (${tasks.length}) ===`);
  tasks.forEach(t => console.log(`${hs(t.completedAt)} | ${t.completedBy || '(s/d)'} | ${t.status} | ${t.client?.name || ''} | ${(t.description || '').slice(0, 100)}`));

  // 6) Movimientos de caja
  const cash = await prisma.cashMovement.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    select: { type: true, amount: true, reason: true, category: true, createdAt: true, user: { select: { name: true } } },
  });
  console.log(`\n=== CAJA - MOVIMIENTOS (${cash.length}) ===`);
  cash.forEach(c => console.log(`${hs(c.createdAt)} | ${c.user?.name || '(s/d)'} | ${c.type} $${c.amount} | ${c.category} | ${(c.reason || '').slice(0, 80)}`));

  const vce = await prisma.vendorCashEntry.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' },
    select: { type: true, amount: true, reason: true, category: true, createdAt: true, createdByName: true, vendor: { select: { name: true } } },
  });
  console.log(`\n=== CAJA POR VENDEDOR (${vce.length}) ===`);
  vce.forEach(v => console.log(`${hs(v.createdAt)} | cargó ${v.createdByName || '(s/d)'} | vendedor ${v.vendor?.name} | ${v.type} $${v.amount} | ${v.category} | ${(v.reason || '').slice(0, 80)}`));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
