/**
 * El POLICARBONATO BLANCO de stock de Grupo Óptico existía, pero con el nombre
 * de otro producto.
 *
 * Ishtar, 10/9/2026: "falta el policarbonato blanco de stock, al parecer, de
 * Grupo Óptico".
 *
 * No faltaba. La página 3 de la lista trae DOS policarbonatos de stock:
 *     POLICARBONATO C/AR     $15.145   esf ±6  cil ±2
 *     POLICARBONATO BLANCO   $12.982   esf ±4  cil ±2   ← SIN antirreflejo
 * Y en el sistema los dos se llamaban "Stock · Policarbonato c/AR 1.59". El de
 * $12.982 es el blanco sin AR: por eso nadie lo encontraba buscando "blanco", y
 * en el cotizador parecían el mismo cristal cargado dos veces con distinto
 * precio. Su pelado coincide al peso con la lista, y su rango ya estaba bien.
 *
 *   node scripts/maintenance/precios-grupo-optico/policarbonato-blanco-stock.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PELADO = 12982;
const NOMBRE = 'Stock · Policarbonato Blanco 1.59 (sin antirreflejo)';
const FIRMA = 'Ishtar (el policarbonato blanco de stock tenía el nombre del c/AR)';

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const ps = await prisma.$queryRaw`
            select id, name from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO' and origin = 'STOCK'
              and round("baseCost") = ${PELADO}`;
        if (ps.length !== 1) { console.error(`Esperaba UN cristal con pelado ${PELADO} y hay ${ps.length}. No toco nada.`); process.exitCode = 1; return; }
        const p = ps[0];
        console.log(`"${p.name}"  ->  "${NOMBRE}"`);
        if (!APLICAR) { console.log('Ensayo: no se escribio nada.'); return; }
        await prisma.$executeRaw`update "Product" set name = ${NOMBRE}, "updatedAt" = now() where id = ${p.id}`;
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                ${JSON.stringify({ nombreDe: p.name, nombreA: NOMBRE, pelado: PELADO,
                    motivo: 'la lista pág. 3 trae POLICARBONATO BLANCO $12.982 (sin AR); estaba nombrado como el c/AR de $15.145' })}::jsonb, now())`;
        console.log('LISTO.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
