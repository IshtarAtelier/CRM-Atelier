/**
 * Tres markups de stock de Grupo Óptico, dictados por Ishtar el 10/9/2026
 * mirando el listado de monofocales ítem por ítem:
 *   · Orgánico Blanco 1.49 ............................ ×4
 *   · Orgánico Blanco 1.49 · Rango Extendido .......... ×4
 *   · Mineral Blanco 1.523 · Esf -4/+4 ................ ×3
 *
 *   node scripts/maintenance/precios-grupo-optico/stock-markups-10-sep.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CAMBIOS = [
    ['Stock · Orgánico Blanco 1.49', 4],
    ['Stock · Orgánico Blanco 1.49 · Rango Extendido', 4],
    ['Stock · Mineral Blanco 1.523 · Esf -4/+4', 3],
];
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) { console.error('Para producción hace falta --produccion.'); process.exitCode = 1; return; }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        for (const [nombre, mk] of CAMBIOS) {
            const ps = await prisma.$queryRaw`select id, cost, price from "Product" where name = ${nombre} and laboratory = 'GRUPO OPTICO'`;
            if (ps.length !== 1) { console.error(`  ${nombre}: esperaba 1 y hay ${ps.length}, no lo toco`); continue; }
            const p = ps[0], nuevo = Math.round(Number(p.cost) * mk);
            console.log(`  ${nombre.padEnd(50)} ${f(p.price)} (x${(p.price / p.cost).toFixed(2)}) -> ${f(nuevo)} (x${mk})   efectivo ${f(nuevo * 0.8)}`);
            if (!APLICAR) continue;
            await prisma.$executeRaw`update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${'Ishtar (markups de stock, 10/9/2026)'}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: nombre, precioDe: Number(p.price), precioA: nuevo, markupA: mk })}::jsonb, now())`;
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
