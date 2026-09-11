/**
 * Devuelve a su precio anterior los más vendidos que un script bajó el 31/8/2026.
 *
 * Ishtar, 10/9/2026: "LOS MÁS VENDIDOS no los bajamos por nada" y, ante la lista
 * de los 5 Essilor New Editions que "markup objetivo por familia" había bajado un
 * 25% para llevarlos a ×2,50 (el Orma Blue UV, 118 ventas), "ok" a restaurarlos.
 *
 * Lee el precio anterior del AuditLog y solo restaura si el precio actual sigue
 * siendo el que dejó ese script: si alguien lo tocó después, no lo pisa.
 *
 *   node scripts/maintenance/precios-optovision/restaurar-mas-vendidos-bajados.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const f = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const aplicar = process.argv.includes('--produccion') && process.argv.includes('--aplicar');
    const prisma = new PrismaClient({ datasources: { db: { url: aplicar ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
    try {
        const log = await prisma.$queryRaw`
            select a."entityId", a.details, p.name, p.price actual,
                   (select count(*)::int from "OrderItem" oi where oi."productId" = p.id) ventas
            from "AuditLog" a join "Product" p on p.id = a."entityId"
            where a."userName" = 'Ishtar (markup objetivo por familia)'`;
        for (const l of log) {
            const de = Number(l.details?.precioDe ?? l.details?.de), a = Number(l.details?.precioA ?? l.details?.a);
            if (!(a < de) || l.ventas === 0) continue;
            const intacto = Math.round(Number(l.actual)) === Math.round(a);
            console.log(`  ${intacto ? '' : '(lo tocaron después, NO se pisa) '}${l.name.slice(0, 60).padEnd(62)} ${f(l.actual)} -> ${f(de)}   ${l.ventas} ventas`);
            if (!aplicar || !intacto) continue;
            await prisma.$executeRaw`update "Product" set price = ${de}, "updatedAt" = now() where id = ${l.entityId}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${'Ishtar (más vendidos: vuelven al precio anterior al 31/8)'}, 'UPDATE', 'PRODUCT', ${l.entityId},
                    ${JSON.stringify({ producto: l.name, precioDe: Number(l.actual), precioA: de, ventas: l.ventas })}::jsonb, now())`;
        }
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
