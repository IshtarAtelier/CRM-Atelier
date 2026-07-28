// SOLO LECTURA. Compara el filtro "Con Saldo" viejo (nominal) contra el nuevo
// (equivalente de lista) y lista los saldos fantasma que desaparecen.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const PROD = process.argv.includes('--prod');
const prisma = PROD
  ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
  : new PrismaClient();

const money = n => '$' + Math.round(n || 0).toLocaleString('es-AR');

async function main() {
  const viejo = await prisma.$queryRaw`
    SELECT id
    FROM "Order"
    WHERE "isDeleted" = false AND COALESCE(NULLIF("subtotalWithMarkup", 0), "total", 0) - COALESCE("paid", 0) > 500
  `;

  const nuevo = await prisma.$queryRaw`
    SELECT o.id
    FROM "Order" o
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
            CASE
                WHEN UPPER(TRIM(p.method)) IN ('CASH', 'EFECTIVO', 'EFVO')
                     AND (1 - COALESCE(o."discountCash", 20) / 100.0) > 0
                    THEN p.amount / (1 - COALESCE(o."discountCash", 20) / 100.0)
                WHEN (UPPER(TRIM(p.method)) LIKE '%TRANSF%' OR UPPER(TRIM(p.method)) LIKE '%DEPOSITO%')
                     AND (1 - COALESCE(o."discountTransfer", 15) / 100.0) > 0
                    THEN p.amount / (1 - COALESCE(o."discountTransfer", 15) / 100.0)
                ELSE p.amount
            END
        ), 0) AS eq
        FROM "Payment" p
        WHERE p."orderId" = o.id
    ) pay ON TRUE
    WHERE o."isDeleted" = false
      AND COALESCE(NULLIF(o."subtotalWithMarkup", 0), o."total", 0)
          - (CASE WHEN pay.eq = 0 AND COALESCE(o."paid", 0) > 0 THEN COALESCE(o."paid", 0) ELSE pay.eq END)
          > 1000
  `;

  const setViejo = new Set(viejo.map(r => r.id));
  const setNuevo = new Set(nuevo.map(r => r.id));
  const fantasma = [...setViejo].filter(id => !setNuevo.has(id));   // marcaba saldo y no lo tiene
  const nuevos = [...setNuevo].filter(id => !setViejo.has(id));     // tiene saldo y no lo marcaba

  console.log(`\nBase: ${PROD ? 'PRODUCCIÓN' : 'local'}`);
  console.log(`Filtro viejo (nominal):            ${setViejo.size} pedidos con saldo`);
  console.log(`Filtro nuevo (equivalente lista):  ${setNuevo.size} pedidos con saldo`);
  console.log(`\n➜ ${fantasma.length} saldos FANTASMA que dejan de aparecer`);
  console.log(`➜ ${nuevos.length} saldos REALES que antes se escondían\n`);

  const detalle = async (ids, titulo) => {
    if (!ids.length) return;
    console.log(`── ${titulo}`);
    const orders = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, createdAt: true, total: true, paid: true, subtotalWithMarkup: true,
        discountCash: true, discountTransfer: true,
        client: { select: { name: true } },
        payments: { select: { amount: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const o of orders) {
      const list = o.subtotalWithMarkup || o.total || 0;
      const dc = o.discountCash ?? 20, dt = o.discountTransfer ?? 15;
      const eq = o.payments.reduce((a, p) => {
        const m = (p.method || '').toUpperCase().trim();
        if (['CASH', 'EFECTIVO', 'EFVO'].includes(m) && 1 - dc / 100 > 0) return a + p.amount / (1 - dc / 100);
        if (['TRANSF', 'DEPOSITO'].some(x => m.includes(x)) && 1 - dt / 100 > 0) return a + p.amount / (1 - dt / 100);
        return a + p.amount;
      }, 0);
      console.log(`   #${o.id.slice(-4).toUpperCase()} ${o.createdAt.toISOString().slice(0, 10)} ${o.client?.name || '-'}`);
      console.log(`      lista ${money(list)} · cobrado ${money(o.paid)} (${o.payments.map(p => p.method).join(', ') || 'sin pagos'}) ⇒ equiv. lista ${money(eq)}`);
      console.log(`      saldo viejo ${money(list - (o.paid || 0))}  →  saldo real ${money(Math.max(0, list - eq))}`);
    }
    console.log('');
  };

  await detalle(fantasma, 'SALDOS FANTASMA (el sistema los inventaba)');
  await detalle(nuevos, 'SALDOS REALES QUE ANTES NO SE VEÍAN');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
