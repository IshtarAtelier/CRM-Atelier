/**
 * Salud de la conciliación de laboratorio: relojes de cada fuente, huérfanos con
 * pista, diferencias de costo sin resolver y ventas sin nº de operación.
 * SOLO LEE. Base: PRODUCCIÓN (PROD_DATABASE_URL). Autorizado por Ishtar 5/9/2026.
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();
const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
const f = d => d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—';
const ars = n => n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR');

async function main() {
    console.log('############ A) RELOJES DE TODOS LOS ROBOTS ############\n');
    const ss = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    for (const r of ss) {
        if (/last_run|lastOk|down_since|alerted_at|backfill|cron|_at$/i.test(r.key)) {
            console.log(`  ${r.key.padEnd(42)} ${String(r.value).slice(0, 40)}   (tocado ${f(r.updatedAt)})`);
        }
    }

    console.log('\n############ B) NOTIFICACIONES POR TIPO (últimos 30 días) ############\n');
    const notifs = await prisma.$queryRaw`
        select type, count(*)::int as n, max("createdAt") as ultima
        from "Notification" where "createdAt" > now() - interval '30 days'
        group by type order by max("createdAt") desc`;
    for (const n of notifs) console.log(`  ${String(n.type).padEnd(34)} ${String(n.n).padStart(5)}   última ${f(n.ultima)}`);

    console.log('\n############ C) CORRIDAS DE LA CONCILIACIÓN (¿doble instancia?) ############\n');
    const runs = await prisma.$queryRaw`
        select date_trunc('day', "runAt" at time zone 'America/Argentina/Buenos_Aires') as dia,
               count(*)::int as corridas,
               array_agg(to_char("runAt" at time zone 'America/Argentina/Buenos_Aires','HH24:MI') order by "runAt") as horas
        from "LabAuditRun" where "runAt" > now() - interval '14 days'
        group by 1 order by 1 desc`;
    for (const r of runs) console.log(`  ${String(r.dia).slice(0,10)}  ${r.corridas} corrida(s) a las ${r.horas.join(', ')}`);

    console.log('\n############ D) HUÉRFANOS: TODOS, CON PISTA ############\n');
    const orphans = await prisma.labCostEntry.findMany({
        where: { status: 'UNMATCHED' },
        orderBy: [{ lab: 'asc' }, { createdAt: 'desc' }],
    });
    console.log(`Total huérfanos: ${orphans.length}\n`);

    // ¿Existe HOY una venta con ese número de operación? (el cruce lo resolvería solo)
    const nums = orphans.map(o => o.labOrderNumber).filter(Boolean);
    const ventasConNumero = await prisma.$queryRaw`
        select id, "labOrderNumber", "clientId" from "Order"
        where "isDeleted" = false and "labOrderNumber" is not null and "labOrderNumber" <> ''`;
    const idx = new Map();
    for (const v of ventasConNumero) {
        for (const m of String(v.labOrderNumber).match(/\d{4,}/g) || []) {
            if (!idx.has(m)) idx.set(m, []);
            idx.get(m).push(v);
        }
    }
    const clientes = new Map((await prisma.client.findMany({ select: { id: true, name: true } })).map(c => [c.id, c.name]));

    const grupos = { YA_TIENE_VENTA: [], SIN_IMPORTE: [], CON_IMPORTE: [] };
    for (const o of orphans) {
        const clave = String(o.labOrderNumber || '').trim();
        const match = idx.get(clave);
        if (match?.length) { grupos.YA_TIENE_VENTA.push({ o, v: match[0] }); continue; }
        const imp = o.billedTotal ?? o.billedNet ?? 0;
        (imp > 0 ? grupos.CON_IMPORTE : grupos.SIN_IMPORTE).push({ o });
    }

    console.log(`--- D1) YA TIENEN VENTA CARGADA (el re-cruce los resuelve solo): ${grupos.YA_TIENE_VENTA.length}`);
    for (const { o, v } of grupos.YA_TIENE_VENTA.slice(0, 40))
        console.log(`   ${o.lab.padEnd(13)} ${o.labOrderNumber.padEnd(22)} → venta de ${clientes.get(v.clientId) || '?'}`);

    console.log(`\n--- D2) CON IMPORTE FACTURADO y SIN venta (plata a reclamar/asignar): ${grupos.CON_IMPORTE.length}`);
    let total = 0;
    for (const { o } of grupos.CON_IMPORTE) {
        const imp = o.billedTotal ?? o.billedNet ?? 0; total += imp;
        const nombre = (o.notes || '').match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
        console.log(`   ${o.lab.padEnd(13)} ${o.labOrderNumber.padEnd(22)} ${ars(imp).padStart(12)}  ${f(o.invoiceDate).slice(0,10).padEnd(11)} ${nombre}`);
    }
    console.log(`   TOTAL EN JUEGO: ${ars(total)}`);

    console.log(`\n--- D3) SIN importe y sin venta (registrados del portal, nunca facturados): ${grupos.SIN_IMPORTE.length}`);
    const porLabSin = {};
    for (const { o } of grupos.SIN_IMPORTE) porLabSin[o.lab] = (porLabSin[o.lab] || 0) + 1;
    console.log('   ' + JSON.stringify(porLabSin));
    for (const { o } of grupos.SIN_IMPORTE.slice(0, 25)) {
        const nombre = (o.notes || '').match(/\(([^,)]{4,60})[,)]/)?.[1]?.trim() || '';
        console.log(`   ${o.lab.padEnd(13)} ${o.labOrderNumber.padEnd(22)} ${f(o.createdAt).slice(0,10).padEnd(11)} ${nombre}`);
    }

    console.log('\n############ E) DIFERENCIAS DE COSTO SIN RESOLVER ############\n');
    const dif = await prisma.$queryRaw`
        select lab, status, count(*)::int as n, sum(difference) as total
        from "LabCostEntry" where status in ('OVERCOST','UNDERCOST') group by 1,2 order by 1,2`;
    for (const d of dif) console.log(`  ${d.lab.padEnd(14)} ${d.status.padEnd(10)} ${String(d.n).padStart(4)}   ${ars(Number(d.total))}`);

    console.log('\n############ F) VENTAS SIN Nº DE OPERACIÓN (lo que persigue el aviso a vendedores) ############\n');
    const sinOp = await prisma.$queryRaw`
        select o.id, c.name as cliente, o."labSentAt", o."labStatus", o.total,
               u.name as vendedor
        from "Order" o
        left join "Client" c on c.id = o."clientId"
        left join "User" u on u.id = o."userId"
        where o."isDeleted" = false and o."orderType"='SALE'
          and o."labSentAt" is not null
          and (o."labOrderNumber" is null or o."labOrderNumber" = '')
          and o."labStatus" <> 'DELIVERED'
        order by o."labSentAt"`;
    console.log(`  ${sinOp.length} venta(s) enviadas al lab sin nº de operación:`);
    for (const s of sinOp) console.log(`    ${f(s.labSentAt).slice(0,10).padEnd(11)} ${String(s.labStatus).padEnd(12)} ${ars(s.total).padStart(12)}  ${s.cliente} (vend. ${s.vendedor || '?'})`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
