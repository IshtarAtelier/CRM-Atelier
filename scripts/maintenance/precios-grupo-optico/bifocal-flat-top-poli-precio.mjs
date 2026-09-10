/**
 * El Bifocal Flat Top de POLICARBONATO salía más barato que el de orgánico Blue
 * Light Cut, aunque al lab le cuesta más ($61.071 contra $52.827).
 *
 * Lo encontró la auditoría de precio contra costo (10/9/2026). Ishtar: "no
 * pueden haber cristales que valen más con markup menor quedando en menos
 * valor" · "no toques nada de multifocales" — este es bifocal.
 *
 * Toma el markup del resto de su línea (×5,14, el de los otros Flat Top) y queda
 * por encima de su hermano. Nunca se vendió: a nadie le cambia un precio pagado.
 *
 *   node scripts/maintenance/precios-grupo-optico/bifocal-flat-top-poli-precio.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 5.14;
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) { console.error('Para producción hace falta --produccion.'); process.exitCode = 1; return; }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const ps = await prisma.$queryRaw`
            select p.id, p.name, p.cost, p.price,
                   (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) ventas
            from "Product" p where p.name = 'Bifocal Flat Top · Policarbonato Blanco 1.59' and p.laboratory = 'GRUPO OPTICO'`;
        if (ps.length !== 1) { console.error(`Esperaba 1 y hay ${ps.length}. No toco nada.`); process.exitCode = 1; return; }
        const p = ps[0];
        if (p.ventas > 0) { console.error(`Tiene ${p.ventas} ventas: no se toca sin preguntar.`); process.exitCode = 1; return; }
        const nuevo = Math.round(Number(p.cost) * MARKUP);
        console.log(`${p.name}: ${f(p.price)} (x${(p.price / p.cost).toFixed(2)}) -> ${f(nuevo)} (x${MARKUP})`);
        if (!APLICAR) return;
        await prisma.$executeRaw`update "Product" set price = ${nuevo}, "updatedAt" = now() where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${'Ishtar (bifocal poli por encima de su hermano más barato)'}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ producto: p.name, precioDe: Number(p.price), precioA: nuevo, markupA: MARKUP })}::jsonb, now())`;
        console.log('LISTO.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
