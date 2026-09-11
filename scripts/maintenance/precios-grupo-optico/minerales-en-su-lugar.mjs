/**
 * Los MINERAL BLANCO de stock, cada uno en su lugar de la escalera por costo.
 *
 * Ishtar, 10/9/2026: "ordená los minerales un poco más arriba". En ×3 quedaban
 * más baratos que cristales que cuestan menos (el Policarbonato Blanco cuesta
 * $20.254 y salía $81.016; el Mineral ±4 cuesta $20.405 y salía $61.215).
 *
 *   · sin cilindro ×4   → el ±2 queda bajo el Policarbonato Blanco y el ±4
 *                         entre el Policarbonato Blanco y el Blue Rango Extendido.
 *   · con cilindro ×4,10 → quedan justo arriba del Fotocromático Gris
 *                         ($115.500), que cuesta menos que ellos.
 * Nunca se vendieron.
 *
 *   node scripts/maintenance/precios-grupo-optico/minerales-en-su-lugar.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const aplicar = process.argv.includes('--produccion') && process.argv.includes('--aplicar');
    const prisma = new PrismaClient({ datasources: { db: { url: aplicar ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
    try {
        const ps = await prisma.$queryRaw`
            select p.id, p.name, p.cost, p.price, (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) v
            from "Product" p where p.laboratory = 'GRUPO OPTICO' and p.name like 'Stock · Mineral Blanco%' order by p.cost, p.name`;
        for (const p of ps) {
            if (p.v > 0) { console.log(`  NO SE TOCA (tiene ${p.v} ventas): ${p.name}`); continue; }
            const mk = /Cil/.test(p.name) ? 4.1 : 4;
            const nuevo = Math.round(Number(p.cost) * mk);
            console.log(`  ${p.name.padEnd(48)} ${f(p.price)} -> ${f(nuevo)} (x${mk})  efectivo ${f(nuevo * 0.8)}`);
            if (!aplicar) continue;
            await prisma.$executeRaw`update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${'Ishtar (minerales en su lugar de la escalera)'}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name, precioDe: Number(p.price), precioA: nuevo, markupA: mk })}::jsonb, now())`;
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
