/**
 * SACA DE LA VENTA el Stellest hasta que Essilor confirme su rango real.
 *
 * Ishtar, 9/9/2026: "el rango del Stellest está mal (−10 a +6) … no lo tenemos,
 * borralo del sistema por ahora hasta que lo tengamos".
 *
 * EL PROBLEMA: el Stellest estaba cargado como que sirve de -10 a **+6**. Es un
 * cristal de control de miopía: solo va para miopes, y todos los demás de esa
 * familia van de -0,25 para abajo. Ese "+6" parece heredado del material Airwear,
 * no del Stellest. Con el bot cruzando receta contra rango desde hoy, un chico
 * hipermétrope podía recibir una cotización de Stellest.
 *
 * NO SE BORRA LA FILA. Tiene 16 ventas: borrarla las deja huérfanas y descuadra
 * los reportes de costo de laboratorio. Se archiva con el prefijo [ARCHIVADO],
 * que es la convención del proyecto, y se apaga la publicación web.
 *
 * SE BORRA EL RANGO, no se corrige. No sabemos el verdadero; dejar el número
 * viejo es peor que no tener ninguno, porque se ve bien y nadie lo duda. El
 * valor que tenía queda en el AuditLog para cuando Essilor conteste.
 *
 * PARA VOLVER A VENDERLO: sacarle el prefijo [ARCHIVADO], cargarle el rango que
 * confirme Essilor y volver a prender `publishToWeb` si corresponde.
 *
 *   node scripts/maintenance/precios-optovision/archivar-stellest.mjs --produccion
 *   node scripts/maintenance/precios-optovision/archivar-stellest.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const PREFIJO = '[ARCHIVADO] ';
const FIRMA = 'Ishtar (Stellest fuera de venta hasta confirmar el rango con Essilor)';

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
            select id, name, "publishToWeb", "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", price
            from "Product" where category = 'Cristal' and name ilike '%stellest%'`;
        if (!ps.length) { console.log('No hay ningún Stellest cargado. Nada que hacer.'); return; }

        for (const p of ps) {
            const ventas = await prisma.$queryRaw`
                select count(*)::int n from "OrderItem" where "productId" = ${p.id}`;
            const yaEsta = p.name.startsWith(PREFIJO);
            console.log(`  ${p.name}`);
            console.log(`    ventas asociadas: ${ventas[0].n}  (por eso NO se borra la fila)`);
            console.log(`    nombre   -> ${yaEsta ? '(ya archivado)' : PREFIJO + p.name}`);
            console.log(`    rango    esf ${p.sphereMin}/${p.sphereMax} cil ${p.cylinderMin}/${p.cylinderMax}  ->  se borra`);
            console.log(`    web      ${p.publishToWeb ? 'publicado' : 'no publicado'} -> no publicado`);

            if (!APLICAR) continue;
            await prisma.$executeRaw`
                update "Product"
                set name = ${yaEsta ? p.name : PREFIJO + p.name},
                    "publishToWeb" = false,
                    "sphereMin" = null, "sphereMax" = null,
                    "cylinderMin" = null, "cylinderMax" = null,
                    "updatedAt" = now()
                where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name,
                        motivo: 'el rango cargado (esf -10/+6) tenía positivos, imposible en un control de miopía; Essilor no confirmó el real',
                        rangoBorrado: { esf: [p.sphereMin, p.sphereMax], cil: [p.cylinderMin, p.cylinderMax] },
                        ventasAsociadas: ventas[0].n, precioAlArchivar: Number(p.price),
                        paraReactivar: 'sacar el prefijo [ARCHIVADO], cargar el rango que confirme Essilor y revisar publishToWeb' })}::jsonb, now())`;
        }
        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }
        console.log('\nLISTO. El Stellest queda fuera del cotizador y de la tienda; su historial de ventas intacto.');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
