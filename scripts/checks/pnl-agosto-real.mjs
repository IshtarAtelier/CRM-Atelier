// SOLO LECTURA. P&L de un mes con criterio devengado, contra la base que indique DB_URL.
// Uso: DB_URL="$PROD_DATABASE_URL" node scripts/checks/pnl-agosto-real.mjs 2026 8
import { PrismaClient } from '@prisma/client';

const [year, month] = [Number(process.argv[2] || 2026), Number(process.argv[3] || 8)];
const from = `${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`;
const to = new Date(new Date(from).getTime());
to.setUTCMonth(to.getUTCMonth() + 1);
const toIso = to.toISOString();

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DB_URL } } });
const q = (sql, params = []) => prisma.$queryRawUnsafe(sql, ...params);

// Ventas del mes: mismo universo que el reporte (SALE, no borradas, labSentAt o createdAt en el mes)
const orders = await q(`
  select o.id, o.status, o.total, o."subtotalWithMarkup", o."specialDiscount", o.paid, o."labStatus",
         c.doctor,
         coalesce((select sum(p.amount) from "Payment" p where p."orderId"=o.id),0) as pagado,
         (select count(*) from "Payment" p where p."orderId"=o.id) as npagos
  from "Order" o join "Client" c on c.id=o."clientId"
  where o."orderType"='SALE' and o."isDeleted"=false
    and ( (o."labSentAt">=$1::timestamptz and o."labSentAt"<$2::timestamptz) or (o."labSentAt" is null and o."createdAt">=$1::timestamptz and o."createdAt"<$2::timestamptz) )
`, [from, toIso]);

const items = await q(`
  select i."orderId", i.quantity, i.eye, i.price,
         coalesce(i."productCostSnapshot", p.cost, 0) as cost,
         upper(coalesce(i."productCategorySnapshot", p.category, '')) as cat,
         coalesce(p.type,'') as ptype
  from "OrderItem" i left join "Product" p on p.id=i."productId"
  where i."orderId" = any($1::text[])
`, [orders.map(o => o.id)]);

const fixed = await q(`select type, sum(amount)::float as amt from "FixedCost" where month=$1::int and year=$2::int group by type`, [month, year]);
const pays = await q(`
  select upper(trim(p.method)) m, count(*)::int n, sum(p.amount)::float amt
  from "Payment" p where p."orderId" = any($1::text[]) group by 1 order by 3 desc`, [orders.map(o => o.id)]);

let facturado = 0, cobrado = 0, cmv = 0, cmvCristal = 0, cmvArmazon = 0, especial = 0, medico = 0, ventasSinPago = 0, webPending = 0;
const byOrder = new Map(orders.map(o => [o.id, { cost: 0 }]));
for (const i of items) {
  const isCristal = i.cat.includes('CRISTAL') || /Cristal|Multifocal|Monofocal/.test(i.ptype);
  let c = Number(i.cost) * i.quantity;
  if (isCristal && i.eye) c = c / 2; // POR PAR
  byOrder.get(i.orderId).cost += c;
  if (isCristal) cmvCristal += c; else cmvArmazon += c;
}
for (const o of orders) {
  if (o.status === 'WEB_PENDING') { webPending++; continue; }
  const lista = Number(o.subtotalWithMarkup || o.total || 0);
  facturado += lista;
  cobrado += Number(o.pagado);
  cmv += byOrder.get(o.id).cost;
  especial += Number(o.specialDiscount || 0);
  if (o.doctor) medico += lista * 0.15;
  if (Number(o.npagos) === 0) ventasSinPago++;
}
const fijos = fixed.filter(f => !f.type || f.type === 'FIJO' || f.type === 'OTRO').reduce((s, f) => s + f.amt, 0);
const marketing = fixed.filter(f => f.type === 'MARKETING').reduce((s, f) => s + f.amt, 0);
const proveedor = fixed.filter(f => f.type === 'PROVEEDOR').reduce((s, f) => s + f.amt, 0);
const bruto = facturado - cmv - medico;
const neto = bruto - fijos - marketing;
const f = n => '$ ' + Math.round(n).toLocaleString('es-AR');
console.log(`Mes ${month}/${year} — ventas: ${orders.length - webPending} (excluidas ${webPending} WEB_PENDING; ${ventasSinPago} sin ningún pago)`);
console.log(`Facturado (lista neta):        ${f(facturado)}`);
console.log(`  cobrado:                     ${f(cobrado)}   pendiente nominal: ${f(facturado - cobrado)}`);
console.log(`CMV cristales (por par):       ${f(cmvCristal)}`);
console.log(`CMV armazones/otros:           ${f(cmvArmazon)}`);
console.log(`CMV total:                     ${f(cmv)}   (${(cmv / facturado * 100).toFixed(1)}% de la venta)`);
console.log(`Honorarios médico (15%):       ${f(medico)}`);
console.log(`= Margen bruto:                ${f(bruto)}   (${(bruto / facturado * 100).toFixed(1)}%)`);
console.log(`Fijos/sueldos (mes completo):  ${f(fijos)}`);
console.log(`Marketing (mes completo):      ${f(marketing)}`);
console.log(`(Proveedores, no se resta):    ${f(proveedor)}`);
console.log(`= Resultado neto:              ${f(neto)}   (${(neto / facturado * 100).toFixed(1)}%)`);
console.log(`Descuentos especiales (info):  ${f(especial)}`);
console.log('Pagos por medio:', pays.map(p => `${p.m} ${p.n}× ${f(p.amt)}`).join(' | '));
await prisma.$disconnect();
