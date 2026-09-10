/**
 * Un RANGO EXTENDIDO nunca puede salir más barato que su versión de stock.
 *
 * Ishtar, 10/9/2026: "ojo que el rango extendido está en menos". Al lab le
 * cuesta MÁS (es más graduación), así que el cliente tiene que pagar más. El
 * Super Blue 1.60 Rango Extendido quedaba a $121.744 contra $159.500 del común.
 *
 * REGLA: si el rango extendido sale más barato que su stock, toma el MISMO
 * markup que su stock. Como su costo es mayor, queda siempre por encima. Solo
 * se corrige cuando está invertido: si ya está arriba, no se toca.
 *
 *   node scripts/maintenance/precios-grupo-optico/rango-extendido-sobre-stock.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (rango extendido nunca por debajo de su stock)';
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const ps = await prisma.$queryRaw`
            select id, name, cost, price from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO' and origin = 'STOCK' and name like 'Stock ·%'`;
        const re = ps.filter(p => / · Rango Extendido$/.test(p.name));
        for (const r of re) {
            const base = ps.find(p => p.name === r.name.replace(/ · Rango Extendido$/, ''));
            if (!base) { console.log(`  sin versión stock para comparar: ${r.name}`); continue; }
            const ok = Number(r.price) > Number(base.price);
            const mk = Number(base.price) / Number(base.cost);
            const nuevo = Math.round(Number(r.cost) * mk);
            console.log(`  ${ok ? 'OK       ' : 'INVERTIDO'} ${r.name}`);
            console.log(`            stock ${f(base.price)} (x${mk.toFixed(2)})  |  rango ext. ${f(r.price)}${ok ? '' : `  ->  ${f(nuevo)}`}`);
            if (ok || !APLICAR) continue;
            await prisma.$executeRaw`update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${r.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${r.id},
                    ${JSON.stringify({ producto: r.name, precioDe: Number(r.price), precioA: nuevo,
                        precioDelStock: Number(base.price), markupDelStock: Number(mk.toFixed(2)) })}::jsonb, now())`;
        }
        console.log(APLICAR ? '\nLISTO.' : '\nEnsayo.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
