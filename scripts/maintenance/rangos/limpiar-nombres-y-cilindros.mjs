/**
 * Últimos detalles del catálogo, tras la auditoría del 9/9/2026.
 *
 * 1. NOMBRES CON ESPACIOS DE MÁS. Tres productos tenían espacio al final. Es
 *    invisible en pantalla pero rompe cualquier búsqueda exacta y hace que dos
 *    productos iguales parezcan distintos.
 *
 * 2. EL NOMBRE QUE CONTRADICE AL DATO. Al Flat Top de policarbonato se le
 *    corrigió el índice a 1.59 (un policarbonato no es 1.49), pero el 1.49
 *    seguía escrito EN EL NOMBRE. Un cristal que dice una cosa y tiene cargada
 *    otra es peor que uno mal cargado: nadie duda del que se ve bien.
 *
 * 3. LOS 5 "ESSILOR NEW EDITIONS" SIN CILINDRO. Son los Sygnus New Edition de
 *    la página 23 cargados con otro nombre (con el AR Numax sumado adentro del
 *    costo). Esa página da cil. 6,00 en los 16 renglones, así que les
 *    corresponde ±6.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/rangos/limpiar-nombres-y-cilindros.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (limpieza final del catálogo)';

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
            select id, name, brand, "cylinderMin", "cylinderMax", "lensIndex"
            from "Product" where category in ('Cristal', 'Tratamiento')`;

        const cambios = [];
        for (const p of ps) {
            const nombre = String(p.name).trim().replace(/\s{2,}/g, ' ')
                .replace('Bifocal Flat Top · Policarbonato Blanco 1.49', 'Bifocal Flat Top · Policarbonato Blanco 1.59');
            const marca = p.brand == null ? null : String(p.brand).trim();
            const ponerCil = /essilor new editions/i.test(p.name) && (p.cylinderMin == null || p.cylinderMax == null);
            if (nombre !== p.name || marca !== p.brand || ponerCil) {
                cambios.push({ p, nombre, marca, cil: ponerCil ? [-6, 6] : null });
            }
        }

        console.log(`${cambios.length} a corregir:`);
        for (const c of cambios) {
            if (c.nombre !== c.p.name) console.log(`  nombre  "${c.p.name}" -> "${c.nombre}"`);
            if (c.marca !== c.p.brand) console.log(`  marca   "${c.p.brand}" -> "${c.marca}"  (${c.p.name})`);
            if (c.cil) console.log(`  cilindro null -> ±6   ${c.p.name}`);
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambios) {
            await prisma.$executeRaw`
                update "Product" set name = ${c.nombre}, brand = ${c.marca},
                    "cylinderMin" = coalesce(${c.cil?.[0] ?? null}, "cylinderMin"),
                    "cylinderMax" = coalesce(${c.cil?.[1] ?? null}, "cylinderMax"),
                    "updatedAt" = now()
                where id = ${c.p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.p.id},
                    ${JSON.stringify({ nombreDe: c.p.name, nombreA: c.nombre, marcaDe: c.p.brand,
                        marcaA: c.marca, cilindro: c.cil })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${cambios.length} corregidos.`);
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
