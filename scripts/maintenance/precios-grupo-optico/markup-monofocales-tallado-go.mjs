/**
 * Lleva a ×3 el markup de los MONOFOCALES DE LABORATORIO de Grupo Óptico.
 *
 * Ishtar, 9/9/2026, viendo que el tallado CNC estaba en ×2,50 y el digital en
 * ×3: "todos movelos a x3".
 *
 * QUÉ TOCA: `price`, y SOLO en los 54 monofocales de tallado (CNC y digital)
 * de GRUPO ÓPTICO. No toca el costo ni ningún otro cristal.
 *
 * 🔴 NUNCA BAJA UN PRECIO. Es la regla de Ishtar sostenida en toda la carga:
 * los que ya están por ENCIMA de ×3 se dejan como están —el Polarizado 1.49
 * quedó en ×3,15 con un precio redondo de $264.000— porque bajarle el precio a
 * algo que ya se vende es regalar margen sin que nadie lo pida.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-grupo-optico/markup-monofocales-tallado-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/markup-monofocales-tallado-go.mjs --produccion
 *   node scripts/maintenance/precios-grupo-optico/markup-monofocales-tallado-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 3;
const FIRMA = 'Ishtar (monofocales de laboratorio de Grupo Óptico a ×3)';

const pesos = n => n == null ? '—' : `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}`);
        console.log(`Objetivo: markup ×${MARKUP} · nunca baja un precio\n`);

        const ps = await prisma.$queryRaw`
            select id, name, cost, price from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO'
              and cost > 0
              and (name ilike '%TALLADO%' or name ilike '%free-form%')
            order by price`;

        const suben = [], quedan = [];
        for (const p of ps) {
            const nuevo = Math.round(Number(p.cost) * MARKUP);
            const mk = Number(p.price) / Number(p.cost);
            if (nuevo > Math.round(Number(p.price))) suben.push({ ...p, nuevo, mk });
            else quedan.push({ ...p, mk });
        }

        console.log(`${ps.length} monofocales de tallado · ${suben.length} suben · ${quedan.length} quedan igual\n`);

        if (suben.length) {
            console.log(`  ${'Cristal'.padEnd(52)}${'markup hoy'.padStart(12)}${'precio hoy'.padStart(13)}${'precio ×3'.padStart(13)}${'sube'.padStart(12)}`);
            for (const p of suben) {
                console.log(`  ${String(p.name).slice(0, 50).padEnd(52)}${('×' + p.mk.toFixed(2)).padStart(12)}` +
                    `${pesos(p.price).padStart(13)}${pesos(p.nuevo).padStart(13)}${pesos(p.nuevo - Number(p.price)).padStart(12)}`);
            }
        }
        if (quedan.length) {
            console.log(`\n  Se dejan como están (ya en ×3 o por encima — no se baja ningún precio):`);
            for (const p of quedan) {
                console.log(`    ×${p.mk.toFixed(2)}  ${String(p.name).slice(0, 50).padEnd(52)}${pesos(p.price).padStart(13)}`);
            }
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const p of suben) {
            await prisma.$executeRaw`
                update "Product" set price = ${p.nuevo}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name, precioDe: Math.round(Number(p.price)), precioA: p.nuevo,
                        costo: Math.round(Number(p.cost)), markupDe: Number(p.mk.toFixed(2)), markupA: MARKUP })}::jsonb, now())`;
        }
        console.log(`\n✅ ${suben.length} precio(s) actualizados a ×${MARKUP}. El costo no se tocó.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
