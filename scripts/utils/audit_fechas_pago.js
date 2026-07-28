// SOLO LECTURA: busca pagos con fecha inverosímil (anteriores al arranque del CRM
// o futuras). Payment.date es la fecha que tipea el vendedor, así que un dedazo en
// el año saca al pago de todos los reportes por rango de fechas.
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '/Users/ishtarpissano/proyectos/atelier/.env' });
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });

const ARG = 3 * 60 * 60 * 1000;
const dia = (d) => new Date(d.getTime() - ARG).toISOString().slice(0, 10);
const hora = (d) => new Date(d.getTime() - ARG).toISOString().slice(0, 16).replace('T', ' ');

async function main() {
  const primero = await prisma.payment.findMany({ orderBy: { date: 'asc' }, take: 1, select: { date: true } });
  console.log('Pago más viejo del sistema:', dia(primero[0].date));

  const ahora = new Date();
  const PISO = new Date('2024-01-01T00:00:00Z');   // antes de esto no había CRM
  const TECHO = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

  const sospechosos = await prisma.payment.findMany({
    where: { OR: [{ date: { lt: PISO } }, { date: { gt: TECHO } }] },
    orderBy: { date: 'asc' },
    select: {
      id: true, date: true, amount: true, method: true, notes: true, createdByName: true,
      order: { select: { id: true, createdAt: true, total: true, paid: true, isDeleted: true, client: { select: { name: true } } } },
    },
  });

  console.log(`\nPagos con fecha fuera de rango (< 2024 o futura): ${sospechosos.length}`);
  for (const p of sospechosos) {
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'PAYMENT', entityId: p.id, action: 'CREATE' },
      select: { createdAt: true, userName: true },
    });
    console.log([
      `id=${p.id}`,
      `fecha guardada: ${dia(p.date)}`,
      `cargado: ${audit ? hora(audit.createdAt) + ' por ' + audit.userName : 'sin registro de auditoría'}`,
      `pedido creado: ${hora(p.order.createdAt)}`,
      `$${p.amount} ${p.method}`,
      `cliente: ${p.order.client?.name}`,
      `pedido: #${p.order.id.slice(-4).toUpperCase()} total $${p.order.total} pagado $${p.order.paid}${p.order.isDeleted ? ' (BORRADO)' : ''}`,
    ].join('\n   '));
    console.log('');
  }

  // Contexto: distribución por año, para ver si hay algo más raro
  const todos = await prisma.payment.findMany({ select: { date: true } });
  const porAnio = {};
  todos.forEach(p => { const a = dia(p.date).slice(0, 4); porAnio[a] = (porAnio[a] || 0) + 1; });
  console.log('Pagos por año:', JSON.stringify(porAnio));

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
