/**
 * ¿Cuánto tarda el nº de operación en llegar al sistema?
 *
 * La operativa es: el vendedor procesa el pedido en el laboratorio, el lab le
 * devuelve el nº de operación y recién ahí lo carga en la venta. El aviso de
 * "pedido sin venta que lo respalde" espera UNMATCHED_GRACE_MS desde que el
 * pedido aparece en el lab antes de dar la alarma — si ese margen es más corto
 * que la demora real, el aviso se llena de falsas alarmas.
 *
 * Este script mide la demora real:
 *   alta de LabCostEntry  →  AuditLog {field:'labOrderNumber'} de esa venta
 *
 * SOLO LEE. Corre contra PRODUCCIÓN (PROD_DATABASE_URL) porque la base local
 * no tiene las ventas al día.
 *
 *   node scripts/checks/lab-desfase-numero-operacion.check.mjs
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const DIAS = 90;
const DESDE = new Date(Date.now() - DIAS * 86400000);

async function main() {
    console.log(`Demora entre "el pedido aparece en el lab" y "el nº queda cargado en la venta"`);
    console.log(`Ventana: últimos ${DIAS} días. Base: producción (solo lectura).\n`);

    const resumen = await prisma.$queryRaw`
        with carga as (
            select e.id,
                   e."createdAt" as visto_en_lab,
                   min(a."createdAt") as cargado
            from "LabCostEntry" e
            join "AuditLog" a
              on a."entityId" = e."orderId"
             and a."entityType" = 'ORDER'
             and a.details->>'field' = 'labOrderNumber'
             and strpos(coalesce(a.details->>'to', ''), e."labOrderNumber") > 0
            where e."createdAt" > ${DESDE}
            group by e.id, e."createdAt"
        ), gap as (
            select extract(epoch from (cargado - visto_en_lab))/60 as min from carga
        )
        select count(*)::int as casos,
               count(*) filter (where min < 0)::int as ya_estaba,
               round(percentile_cont(0.5) within group (order by min)::numeric, 1) as mediana,
               round(percentile_cont(0.9) within group (order by min)::numeric, 1) as p90,
               round(max(min)::numeric, 1) as peor
        from gap where min >= 0`;

    const r = resumen[0] || {};
    console.log(`Casos medidos: ${r.casos ?? 0} (más ${r.ya_estaba ?? 0} que ya estaban cargados antes de aparecer en el lab)`);
    console.log(`  mediana: ${r.mediana} min · 9 de cada 10 dentro de: ${r.p90} min · peor caso: ${r.peor} min\n`);

    const buckets = await prisma.$queryRaw`
        with carga as (
            select e.id, e."createdAt" as visto_en_lab, min(a."createdAt") as cargado
            from "LabCostEntry" e
            join "AuditLog" a
              on a."entityId" = e."orderId"
             and a."entityType" = 'ORDER'
             and a.details->>'field' = 'labOrderNumber'
             and strpos(coalesce(a.details->>'to', ''), e."labOrderNumber") > 0
            where e."createdAt" > ${DESDE}
            group by e.id, e."createdAt"
        )
        select case
                 when min < 0    then 'ya estaba cargado antes'
                 when min <= 4   then 'hasta 4 min'
                 when min <= 15  then '4 a 15 min'
                 when min <= 30  then '15 a 30 min'
                 when min <= 60  then '30 a 60 min'
                 when min <= 240 then '1 a 4 horas'
                 when min <= 1440 then '4 a 24 horas'
                 else 'más de un día'
               end as demora,
               count(*)::int as cantidad
        from (select extract(epoch from (cargado - visto_en_lab))/60 as min from carga) t
        group by 1 order by min(min)`;

    console.log('Distribución:');
    for (const b of buckets) console.log(`  ${String(b.demora).padEnd(24)} ${b.cantidad}`);

    const orphans = await prisma.$queryRaw`
        select case when "createdAt" > now() - interval '1 day' then 'último día'
                    when "createdAt" > now() - interval '7 days' then 'última semana'
                    when "createdAt" > now() - interval '30 days' then 'último mes'
                    else 'más viejo' end as antiguedad,
               count(*)::int as cantidad,
               min("createdAt") as desde
        from "LabCostEntry" where status = 'UNMATCHED'
        group by 1 order by min("createdAt") desc`;

    console.log('\nPedidos que HOY siguen sin venta:');
    for (const o of orphans) console.log(`  ${String(o.antiguedad).padEnd(16)} ${o.cantidad}`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
