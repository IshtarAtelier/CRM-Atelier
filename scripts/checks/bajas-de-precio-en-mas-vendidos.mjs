/**
 * ¿Se le BAJÓ el precio a algún producto que se vende? SOLO LEE.
 *
 * Regla de Ishtar (10/9/2026): "LOS MÁS VENDIDOS no los bajamos por nada".
 * Recorre el AuditLog desde una fecha y lista toda baja de precio sobre un
 * producto con ventas, con quién la hizo. Lee los tres formatos que conviven en
 * el log: precioDe/precioA (scripts), before.price/after.price (pantalla de
 * edición) y de/a (Aumentar Precios).
 *
 *   node scripts/checks/bajas-de-precio-en-mas-vendidos.mjs --produccion [--desde 2026-08-25]
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const PRODUCCION = process.argv.includes('--produccion');
const i = process.argv.indexOf('--desde');
const DESDE = i > 0 ? process.argv[i + 1] : '2026-08-25';
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const prisma = new PrismaClient({ datasources: { db: { url: PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
    try {
        const log = await prisma.$queryRaw`
            select a."createdAt", a."userName", a."entityId", a.details, p.name, p.price actual,
                   (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) ventas
            from "AuditLog" a join "Product" p on p.id = a."entityId"
            where a."entityType" = 'PRODUCT' and a."createdAt" >= ${new Date(DESDE)}
            order by a."createdAt"`;
        const bajas = [];
        for (const l of log) {
            const d = l.details ?? {};
            const de = d.precioDe ?? d.before?.price ?? d.de;
            const a = d.precioA ?? d.after?.price ?? d.a;
            if (de == null || a == null || !(Number(a) < Number(de))) continue;
            bajas.push({ ...l, de: Number(de), a: Number(a) });
        }
        const conVentas = bajas.filter(b => b.ventas > 0);
        console.log(`Desde ${DESDE}: ${bajas.length} bajas de precio · ${conVentas.length} sobre productos CON ventas\n`);
        for (const b of conVentas) {
            console.log(`  ${b.createdAt.toISOString().slice(0, 16)}  ${String(b.ventas).padStart(4)} ventas  ${b.name.slice(0, 56).padEnd(58)} ${f(b.de)} -> ${f(b.a)}  (hoy ${f(b.actual)})`);
            console.log(`${' '.repeat(20)}por: ${b.userName}`);
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
