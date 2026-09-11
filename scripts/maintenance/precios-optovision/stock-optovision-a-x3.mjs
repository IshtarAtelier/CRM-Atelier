/**
 * Los lentes de STOCK de Optovisión a ×3.
 *
 * Ishtar, 10/9/2026: "los de stock de opto pasalos a x3".
 *
 * EXCEPCIÓN: el HD MR7 1.67. Está en ×4,28 y es el monofocal de stock de
 * Optovisión más vendido (86 ventas): pasarlo a ×3 sería BAJARLE el precio a un
 * más vendido, y la regla de Ishtar es no tocarlos. Queda como está.
 *
 *   node scripts/maintenance/precios-optovision/stock-optovision-a-x3.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 3;
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) { console.error('Para producción hace falta --produccion.'); process.exitCode = 1; return; }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const ps = await prisma.$queryRaw`
            select p.id, p.name, p.cost, p.price, (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) v
            from "Product" p where p.category = 'Cristal' and p.laboratory = 'OPTOVISION' and p.origin = 'STOCK'
              and p.name not like '[ARCHIVADO]%' and p.cost > 0 order by p.cost`;
        for (const p of ps) {
            const nuevo = Math.round(Number(p.cost) * MARKUP);
            const excluido = /HD MR7/i.test(p.name) && nuevo < Number(p.price);
            console.log(`  ${excluido ? 'NO SE TOCA' : '          '} ${p.name.slice(0, 64).padEnd(66)} ${f(p.price).padStart(10)} (x${(p.price / p.cost).toFixed(2)}) -> ${excluido ? '—' : f(nuevo)}  ${p.v ? p.v + ' ventas' : ''}`);
            if (!APLICAR || excluido) continue;
            await prisma.$executeRaw`update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${'Ishtar (stock de Optovisión a ×3)'}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name, precioDe: Number(p.price), precioA: nuevo, markupA: MARKUP })}::jsonb, now())`;
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
