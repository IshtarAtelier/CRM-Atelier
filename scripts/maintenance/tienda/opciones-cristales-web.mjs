/**
 * Carga en la configuración de la tienda QUÉ PRODUCTO es cada opción de cristal,
 * por ID (SystemSetting.web_cristales_opciones). Los ids viven en
 * opciones-cristales-web.json, con de dónde salió cada uno.
 *
 * Por qué por ID: la tienda los buscaba por nombre y un rename la dejó con
 * precios equivocados sin que nadie se enterara (ver resolverOpcionWeb en
 * src/lib/checkout/checkout-pricing.ts). Las opciones en null NO se cargan:
 * siguen resolviéndose por palabra clave hasta que se decidan.
 *
 * Verifica ANTES de escribir que cada id exista y sea vendible en la base
 * contra la que corre.
 *
 *   node scripts/maintenance/tienda/opciones-cristales-web.mjs --produccion              # ensayo
 *   node scripts/maintenance/tienda/opciones-cristales-web.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

config();
const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CLAVE = 'web_cristales_opciones';
const datos = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'opciones-cristales-web.json'), 'utf8'));

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url ?? '')) { console.error('Para producción hace falta --produccion.'); process.exitCode = 1; return; }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        const opciones = {};
        let problemas = 0;
        for (const [clave, o] of Object.entries(datos.opciones)) {
            if (!o.id) { console.log(`  ⏸  ${clave.padEnd(34)} ${o.producto}`); continue; }
            const [p] = await prisma.$queryRaw`select id, name, price from "Product" where id = ${o.id}`;
            if (!p) { console.log(`  ❌ ${clave.padEnd(34)} el id ${o.id} no existe en esta base`); problemas++; continue; }
            if (/^\s*\[archivado\]/i.test(p.name)) { console.log(`  ❌ ${clave.padEnd(34)} ${p.name} está ARCHIVADO`); problemas++; continue; }
            console.log(`  ✓  ${clave.padEnd(34)} ${p.name}  $${Math.round(p.price).toLocaleString('es-AR')}`);
            opciones[clave] = o.id;
        }
        if (problemas) { console.error(`\n${problemas} problema(s): no se escribe nada.`); process.exitCode = 1; return; }
        if (!APLICAR) { console.log(`\nEnsayo: se cargarían ${Object.keys(opciones).length} opciones en ${CLAVE}. Para aplicarlo: --aplicar`); return; }
        await prisma.systemSetting.upsert({
            where: { key: CLAVE },
            create: { key: CLAVE, value: JSON.stringify(opciones) },
            update: { value: JSON.stringify(opciones) },
            select: { key: true },
        });
        await prisma.$executeRaw`
            insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
            values (gen_random_uuid()::text, ${'Ishtar (opciones de cristal de la tienda, por id)'}, 'UPDATE', 'SETTING', ${CLAVE},
                ${JSON.stringify({ opciones })}::jsonb, now())`;
        console.log(`\nLISTO: ${Object.keys(opciones).length} opciones cargadas en ${CLAVE}.`);
    } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
