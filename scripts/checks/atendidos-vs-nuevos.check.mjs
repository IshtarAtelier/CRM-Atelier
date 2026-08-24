// ────────────────────────────────────────────────────────────────────────────
// "CLIENTES ATENDIDOS" del dashboard: que sea LA MISMA GENTE que los nuevos.
//
// La tarjeta muestra "X atendidos · Y% de los nuevos" al lado del contador de
// contactos nuevos, así que tiene que contar a los que ENTRARON en el período
// y ya tienen presupuesto. La primera versión (24/8/26) contaba clientes
// cualesquiera con un presupuesto hecho en el período: mostraba "13 atendidos
// · 100% de los nuevos" cuando de los 13 nuevos solo 3 tenían presupuesto.
//
// Corre la MISMA consulta que el dashboard y la contrasta con un conteo
// independiente (traer los nuevos y contar a mano los que tienen orden).
// Corre contra PRODUCCIÓN, solo lectura.
// Correr:  node --env-file=.env scripts/checks/atendidos-vs-nuevos.check.mjs
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
const ART = 3*60*60*1000; const n = new Date();
const hoy   = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) + ART);
const d7    = new Date(hoy.getTime() - 6*86400000);
const d30   = new Date(hoy.getTime() - 29*86400000);

// LA MISMA consulta que quedó en el dashboard
let fallas = 0;
// MISMA consulta que el dashboard para "clientes de antes"
const viejosEn = async (desde) => {
  const f = await prisma.order.findMany({
    where: { isDeleted: false, createdAt: { gte: desde },
             client: { isDeleted: false, createdAt: { lt: desde } } },
    select: { clientId: true }, distinct: ['clientId'],
  });
  return f.length;
};
const atendidosEn = (desde) => prisma.client.count({
  where: { isDeleted: false, createdAt: { gte: desde }, orders: { some: { isDeleted: false } } },
});
const nuevosEn = (desde) => prisma.client.count({ where: { isDeleted: false, createdAt: { gte: desde } } });

for (const [lbl, desde] of [['HOY', hoy], ['7 DÍAS', d7], ['30 DÍAS', d30]]) {
  const [nuevos, atendidos] = await Promise.all([nuevosEn(desde), atendidosEn(desde)]);
  const pct = nuevos > 0 ? Math.round(atendidos/nuevos*100) : 0;
  // Contraste independiente: listar los nuevos y contar a mano los que tienen orden
  const lista = await prisma.client.findMany({
    where: { isDeleted: false, createdAt: { gte: desde } },
    select: { orders: { where: { isDeleted: false }, select: { id: true } } },
  });
  const aMano = lista.filter(c => c.orders.length > 0).length;
  const viejos = await viejosEn(desde);
  // Contraste independiente de "viejos": total de clientes distintos con orden
  // en el período, menos los nuevos que tienen orden.
  const todosConOrden = await prisma.order.findMany({
    where: { isDeleted: false, createdAt: { gte: desde }, client: { isDeleted: false } },
    select: { clientId: true }, distinct: ['clientId'],
  });
  const viejosAMano = todosConOrden.length - aMano;
  const ok = aMano === atendidos && viejos === viejosAMano;
  if (!ok) fallas++;
  console.log(`  ${ok ? '✅' : '❌'} ${lbl.padEnd(8)} nuevos ${String(nuevos).padStart(4)} · con presupuesto ${String(atendidos).padStart(4)} (${pct}%) · clientes de antes ${String(viejos).padStart(4)} · atendidos en total ${String(atendidos + viejos).padStart(4)}`);
  if (!ok) console.error(`       esperaba con-presupuesto=${aMano} y de-antes=${viejosAMano}`);
}
await prisma.$disconnect();

if (fallas > 0) { console.error(`\n❌ ${fallas} período(s) donde la consulta del dashboard no coincide con el conteo a mano.`); process.exit(1); }
console.log('\n✅ "Clientes atendidos" cuenta a los contactos NUEVOS con presupuesto, no a cualquiera.');
