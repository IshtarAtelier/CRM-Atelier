/**
 * Le saca al STELLEST el rango de graduación, que estaba mal.
 *
 * Ishtar, 9/9/2026: "no lo tenemos, borralo del sistema por ahora hasta que lo
 * tengamos" — el RANGO, no el producto. El Stellest **sigue a la venta**.
 *
 * EL PROBLEMA: figuraba como que sirve de -10 a **+6**. Es un cristal de control
 * de miopía: va solo para miopes, y todos los demás de esa familia van de -0,25
 * para abajo. Ese "+6" parece heredado del material Airwear, no del Stellest.
 *
 * POR QUÉ SE BORRA EN VEZ DE CORREGIRSE: no sabemos el verdadero. Dejar el
 * número viejo es peor que no tener ninguno, porque se ve bien y nadie lo duda.
 * Vacío, la ficha muestra "—" y el vendedor pregunta. El valor que tenía queda
 * en el AuditLog para cuando Essilor conteste.
 *
 * Cuando llegue el rango real: cargarlo en sphereMin/sphereMax y
 * cylinderMin/cylinderMax, y listo. No hay nada más que revertir.
 *
 *   node scripts/maintenance/precios-optovision/stellest-sacar-rango.mjs --produccion
 *   node scripts/maintenance/precios-optovision/stellest-sacar-rango.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const FIRMA = 'Ishtar (Stellest sin rango hasta que Essilor confirme el real)';

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
            select id, name, "sphereMin", "sphereMax", "cylinderMin", "cylinderMax"
            from "Product" where category = 'Cristal' and name ilike '%stellest%'`;
        if (!ps.length) { console.log('No hay ningún Stellest cargado.'); return; }

        for (const p of ps) {
            const tenia = p.sphereMin != null || p.cylinderMin != null;
            console.log(`  ${p.name}`);
            console.log(`    esf ${p.sphereMin}/${p.sphereMax}  cil ${p.cylinderMin}/${p.cylinderMax}  ->  ${tenia ? 'sin rango' : '(ya estaba sin rango)'}`);
            if (!APLICAR || !tenia) continue;
            await prisma.$executeRaw`
                update "Product" set "sphereMin" = null, "sphereMax" = null,
                    "cylinderMin" = null, "cylinderMax" = null, "updatedAt" = now()
                where id = ${p.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${p.id},
                    ${JSON.stringify({ producto: p.name,
                        motivo: 'el rango cargado tenía positivos, imposible en un control de miopía; Essilor no confirmó el real',
                        rangoBorrado: { esf: [p.sphereMin, p.sphereMax], cil: [p.cylinderMin, p.cylinderMax] },
                        sigueALaVenta: true })}::jsonb, now())`;
        }
        console.log(APLICAR ? '\nLISTO. El Stellest sigue a la venta, sin rango cargado.' : '\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar');
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
