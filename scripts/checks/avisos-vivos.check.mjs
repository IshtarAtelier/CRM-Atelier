/** ¿Qué avisos están vivos? SOLO LEE. Producción. Autorizado por Ishtar 5/9/2026. */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();
const prisma = new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } });
const f = d => d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—';
const ars = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR');

async function main() {
    console.log('=== 1) ¿Se están mandando cosas DOS VECES? (doble instancia) ===');
    const dup = await prisma.$queryRaw`
        select type, "orderId", count(*)::int as veces, min("createdAt") as primera, max("createdAt") as ultima
        from "Notification"
        where "createdAt" > now() - interval '20 days' and "orderId" is not null
        group by type, "orderId" having count(*) > 1
        order by max("createdAt") desc limit 20`;
    if (!dup.length) console.log('  Ninguna notificación repetida por venta en 20 días. ✅');
    for (const d of dup) console.log(`  ${String(d.type).padEnd(30)} x${d.veces}  ${f(d.primera)} → ${f(d.ultima)}`);

    console.log('\n=== 2) Último aviso de cada tipo (¿cuál dejó de correr?) ===');
    const tipos = await prisma.$queryRaw`
        select type, max("createdAt") as ultima, count(*)::int as total
        from "Notification" group by type order by max("createdAt") desc`;
    const hoy = Date.now();
    for (const t of tipos) {
        const dias = Math.floor((hoy - new Date(t.ultima).getTime()) / 86400000);
        const señal = dias > 20 ? '  ⛔ MUDO' : dias > 7 ? '  ⚠️' : '  ✅';
        console.log(`  ${String(t.type).padEnd(32)} hace ${String(dias).padStart(3)} día(s)  (${t.total} en total)${señal}`);
    }

    console.log('\n=== 3) Saldos vencidos hoy (lo que debería perseguir overdue-balances) ===');
    const saldos = await prisma.$queryRaw`
        select count(*)::int as n from "Order"
        where "isDeleted" = false and "orderType"='SALE' and "labStatus"='DELIVERED'
          and "createdAt" > now() - interval '180 days'`;
    console.log(`  ventas entregadas en 180 días: ${saldos[0].n}`);

    console.log('\n=== 4) Pedidos listos esperando retiro (lo que persigue pickup-reminder) ===');
    const listos = await prisma.$queryRaw`
        select o.id, c.name, o."labStatus", o."smartLabLastSync", o."labSentAt"
        from "Order" o left join "Client" c on c.id=o."clientId"
        where o."isDeleted"=false and o."labStatus"='READY' order by o."labSentAt" desc limit 15`;
    console.log(`  ${listos.length} en estado LISTO:`);
    for (const l of listos) console.log(`    ${String(l.name).padEnd(30)} enviado ${f(l.labSentAt).slice(0,10)}  último sync ${f(l.smartLabLastSync).slice(0,10)}`);

    console.log('\n=== 5) Cuenta corriente: historial de resúmenes recibidos ===');
    const st = await prisma.labAccountStatement.findMany({ orderBy: { statementDate: 'desc' }, take: 10 });
    for (const s of st) console.log(`  ${s.lab.padEnd(13)} al ${f(s.statementDate).slice(0,10)}  deuda ${ars(s.totalDebt).padStart(13)}  ${s.invoiceCount} comprob.  recibido ${f(s.createdAt).slice(0,10)}`);
    const labsConSt = new Set(st.map(s => s.lab));
    if (!labsConSt.has('GRUPO_OPTICO')) console.log('  ⛔ GRUPO_OPTICO: nunca se cargó un resumen de cuenta.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
