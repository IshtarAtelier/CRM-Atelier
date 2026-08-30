/**
 * Dos arreglos puntuales confirmados por Ishtar:
 *
 * 1. RENOMBRAR "Monofocal XPERIO con crizal PREVENCIA" → agrega el material
 *    (ORMA). Su costo calza casi exacto con Xperio ORMA + Prevencia suelto
 *    (dif. $1.438) y con el nombre completo cruza solo con la lista y queda
 *    señalizado LABORATORIO ("metele a lo que convenga", 30/8/2026).
 * 2. BORRAR "KODAK PRECISE - ORMA ACCLIMATES 2x1": no existe en la lista del
 *    laboratorio (Precise Next no ofrece Acclimates — verificado en el PDF
 *    por Ishtar el 26/8) y NUNCA se usó en una venta. Se borra con rastro.
 *
 * Ensayo por defecto.
 *   node scripts/maintenance/precios-optovision/arreglos-puntuales.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();
const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (arreglos puntuales del catálogo Optovisión)';
const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base'); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ Para producción hace falta --produccion.'); process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const NOMBRE_NUEVO = 'Monofocal XPERIO ORMA con Crizal Prevencia';

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR' : 'ENSAYO'}\n`);

    const [xperio] = await prisma.$queryRaw`
        select id, name from "Product" where name ilike ${'Monofocal XPERIO con crizal PREVENCIA%'} limit 1`;
    console.log(xperio
        ? `1. Renombrar: "${xperio.name.trim()}" → "${NOMBRE_NUEVO}"`
        : '1. (el Monofocal XPERIO ya no está con el nombre viejo)');

    const [acclimates] = await prisma.$queryRaw`
        select id, name from "Product" where name ilike ${'%KODAK PRECISE%ACCLIMATES%'} limit 1`;
    if (acclimates) {
        const [uso] = await prisma.$queryRaw`select count(*)::int as n from "OrderItem" where "productId" = ${acclimates.id}`;
        console.log(`2. Borrar: "${acclimates.name}" · usado en ventas: ${uso.n}${uso.n > 0 ? '  ← NO SE BORRA, tiene ventas' : ''}`);
        if (uso.n > 0) acclimates.bloqueado = true;
    } else console.log('2. (el Kodak Acclimates ya no está)');

    if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

    if (xperio) {
        await prisma.$executeRaw`update "Product" set name = ${NOMBRE_NUEVO}, origin = ${'LABORATORIO'}, "updatedAt" = now() where id = ${xperio.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${xperio.id},
                ${JSON.stringify({ de: xperio.name, a: NOMBRE_NUEVO, motivo: 'el nombre no decía el material; con ORMA cruza solo con la lista' })}::jsonb, now())`;
        console.log('✅ renombrado');
    }
    if (acclimates && !acclimates.bloqueado) {
        await prisma.$executeRaw`delete from "Product" where id = ${acclimates.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'DELETE', 'PRODUCT', ${acclimates.id},
                ${JSON.stringify({ producto: acclimates.name, motivo: 'no existe en la lista del laboratorio (Precise Next no ofrece Acclimates) y nunca se vendió' })}::jsonb, now())`;
        console.log('✅ borrado');
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
