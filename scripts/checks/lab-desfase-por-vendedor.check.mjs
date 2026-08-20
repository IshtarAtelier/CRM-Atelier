/**
 * ¿QUIÉN demora en cargar el nº de operación, y en qué ventas?
 *
 * Complemento de lab-desfase-numero-operacion.check.mjs (que mide el CUÁNTO).
 * Acá se abre por persona: quién cargó el número, cuánto tardó desde que el
 * pedido apareció en el laboratorio, y el detalle de los casos que pasaron el
 * margen del aviso (UNMATCHED_GRACE_MS) — que son los que generan el mail de
 * "pedido sin venta que lo respalde".
 *
 * SOLO LEE. Corre contra PRODUCCIÓN (PROD_DATABASE_URL).
 *
 *   node scripts/checks/lab-desfase-por-vendedor.check.mjs
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL en el .env'); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url } } });
const DIAS = 90;
const DESDE = new Date(Date.now() - DIAS * 86400000);
const GRACIA_MIN = 4; // UNMATCHED_GRACE_MS actual

const fmt = (m) => m < 60 ? `${Math.round(m)} min`
    : m < 1440 ? `${(m / 60).toFixed(1)} h`
    : `${(m / 1440).toFixed(1)} días`;

async function main() {
    const casos = await prisma.$queryRaw`
        with carga as (
            select e.id, e.lab, e."labOrderNumber", e."orderId",
                   e."createdAt" as visto_en_lab,
                   min(a."createdAt") as cargado,
                   (array_agg(a."userName" order by a."createdAt"))[1] as quien
            from "LabCostEntry" e
            join "AuditLog" a
              on a."entityId" = e."orderId"
             and a."entityType" = 'ORDER'
             and a.details->>'field' = 'labOrderNumber'
             and strpos(coalesce(a.details->>'to', ''), e."labOrderNumber") > 0
            where e."createdAt" > ${DESDE}
            group by e.id, e.lab, e."labOrderNumber", e."orderId", e."createdAt"
        )
        select c.*, upper(right(o.id, 4)) as venta, o."labSentBy" as vendedor, cl.name as cliente,
               extract(epoch from (c.cargado - c.visto_en_lab))/60 as min
        from carga c
        left join "Order" o on o.id = c."orderId"
        left join "Client" cl on cl.id = o."clientId"
        where c.cargado > c.visto_en_lab
        order by min desc`;

    const porPersona = new Map();
    for (const c of casos) {
        const k = c.quien || '(sin firma)';
        if (!porPersona.has(k)) porPersona.set(k, []);
        porPersona.get(k).push(Number(c.min));
    }

    console.log(`Quién carga tarde el nº de operación — últimos ${DIAS} días (producción, solo lectura)`);
    console.log(`Solo los casos donde el número se cargó DESPUÉS de que el pedido apareció en el lab.\n`);
    console.log('Persona'.padEnd(24) + 'casos'.padStart(6) + `  pasan ${GRACIA_MIN}min`.padStart(12) + 'mediana'.padStart(12) + 'peor'.padStart(12));
    const orden = [...porPersona.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [quien, mins] of orden) {
        const s = [...mins].sort((a, b) => a - b);
        const mediana = s[Math.floor(s.length / 2)];
        const tarde = s.filter(m => m > GRACIA_MIN).length;
        console.log(quien.padEnd(24) + String(s.length).padStart(6) + String(tarde).padStart(12)
            + fmt(mediana).padStart(12) + fmt(s[s.length - 1]).padStart(12));
    }

    console.log(`\nCasos que dispararon (o habrían disparado) el aviso — más de ${GRACIA_MIN} min:\n`);
    console.log('Demora'.padEnd(12) + 'Cargó el nº'.padEnd(22) + 'Envió a fábrica'.padEnd(22)
        + 'Lab'.padEnd(15) + 'Nº pedido'.padEnd(12) + 'Venta'.padEnd(8) + 'Cliente');
    for (const c of casos.filter(c => Number(c.min) > GRACIA_MIN)) {
        console.log(fmt(Number(c.min)).padEnd(12)
            + String(c.quien || '(sin firma)').slice(0, 20).padEnd(22)
            + String(c.vendedor || '—').slice(0, 20).padEnd(22)
            + String(c.lab).padEnd(15)
            + String(c.labOrderNumber).padEnd(12)
            + String(c.venta || '—').padEnd(8)
            + String(c.cliente || '—'));
    }
}

main().catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
