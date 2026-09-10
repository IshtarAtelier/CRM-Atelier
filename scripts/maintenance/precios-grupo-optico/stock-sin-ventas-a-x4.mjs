/**
 * Baja a ×4 los lentes de STOCK de Grupo Óptico que quedaron en ×4,81 y nunca
 * se vendieron.
 *
 * Ishtar, 10/9/2026, viendo el cuadro del stock: "el poli blanco y todos esos que
 * vimos de stock, así no se van tan caros".
 *
 * Esos nueve se cargaron el 8/9 con el markup genérico (×4,81) cuando la regla
 * que ella había dado para el stock era ×4, salvo los más vendidos. El
 * Policarbonato Blanco quedaba a $97.000 —3,7 veces el Orgánico Blanco, cuando
 * al lab le cuesta menos del doble—.
 *
 * SOLO los que tienen CERO ventas: bajarles el precio no le cambia nada a nadie
 * que ya compró. Los que se venden (Blue c/AR, Super Blue, Orgánico Blanco,
 * Fotocromático, Policarbonato c/AR…) tienen precios que Ishtar ya ajustó y no
 * se tocan.
 *
 *   node scripts/maintenance/precios-grupo-optico/stock-sin-ventas-a-x4.mjs --produccion
 *   node scripts/maintenance/precios-grupo-optico/stock-sin-ventas-a-x4.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 4;
const FIRMA = 'Ishtar (stock sin ventas de Grupo Óptico a ×4)';
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR' : 'ENSAYO'}\n`);
        const ps = await prisma.$queryRaw`
            select p.id, p.name, p.cost, p.price,
                   (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) ventas
            from "Product" p
            where p.category = 'Cristal' and p.laboratory = 'GRUPO OPTICO' and p.origin = 'STOCK'
              and p.name like 'Stock ·%' and p.cost > 0
            order by p.cost`;
        const bajan = ps.filter(p => p.ventas === 0 && Number(p.price) > Math.round(Number(p.cost) * MARKUP))
            .map(p => ({ ...p, nuevo: Math.round(Number(p.cost) * MARKUP) }));

        console.log(`  ${'Cristal'.padEnd(64)}${'hoy'.padStart(11)}${'a x4'.padStart(11)}${'baja'.padStart(10)}`);
        for (const p of bajan) console.log(`  ${p.name.slice(0, 62).padEnd(64)}${f(p.price).padStart(11)}${f(p.nuevo).padStart(11)}${f(Number(p.price) - p.nuevo).padStart(10)}`);
        console.log(`\n${bajan.length} bajan · no se tocan los ${ps.filter(p => p.ventas > 0).length} que tienen ventas`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }
        for (const p of bajan) {
            await prisma.$executeRaw`update "Product" set price = ${p.nuevo}, "updatedAt" = now() where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name, precioDe: Number(p.price), precioA: p.nuevo,
                        costo: Number(p.cost), markupA: MARKUP, ventas: 0 })}::jsonb, now())`;
        }
        console.log('\nLISTO.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
