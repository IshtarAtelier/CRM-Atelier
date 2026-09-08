/**
 * Cierra lo que faltaba de la lista de Grupo Óptico y deja escrito en el nombre
 * si el cristal es TALLADO (CNC) o DIGITAL (free-form).
 *
 * Tres cosas, pedidas por Ishtar el 8/9/2026:
 *
 * 1. LOS SOL NEUTROS. Una sección entera de la lista que nunca se transcribió a
 *    productos: lentes de sol sin graduación, que se describen por base y
 *    diámetro. Son 5 con precio (el Mineral Compacto no lo publica). Van a ×4,
 *    el markup de los lentes de stock, que es su pariente más cercano: también
 *    son lentes terminadas.
 *
 * 2. QUE EL NOMBRE DIGA TALLADO O DIGITAL. La lista lo aclara al pie —"CNC =
 *    lente tallada convencional, ULTRA = lente digital (free-form)"— pero en el
 *    sistema los nombres decían "Monofocal laboratorio" y "Monofocal digital",
 *    que no le dice nada a quien no conoce la lista. Con la palabra adentro, el
 *    vendedor sabe qué está cotizando y por qué uno vale más que el otro.
 *
 * 3. LOS RENGLONES QUE FALTABAN. Cuatro materiales que el emparejador no podía
 *    encontrar porque su nombre en el sistema no los distinguía (dos diámetros
 *    del Orgánico Blanco, el Fotocromático BLUE y el Gris 3 Espejado Azul).
 *
 *   node scripts/maintenance/precios-grupo-optico/completar-lista-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/completar-lista-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { emparejar, datos as d } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CALIBRADO = 7272;
const MARKUP_SOL = 4;   // el de los lentes de stock: también son lentes terminadas
const FIRMA = 'Ishtar (lista de Grupo Óptico completada)';

const $ = n => '$' + Math.round(n).toLocaleString('es-AR');

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('❌ DATABASE_URL no apunta a localhost. Para producción hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}\n`);
        const ps = await prisma.$queryRaw`
            select id, name, model, "lensIndex", origin, price, cost, "baseCost"
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;

        // ── 1. Los sol neutros que faltan ────────────────────────────────────
        const yaEstan = new Set(ps.map(x => x.name.trim()));
        const altas = [];
        for (const f of (d.sol_neutros?.filas ?? []).filter(f => f.precio != null)) {
            const nombre = `Sol neutro - ${f.producto}`;
            if (yaEstan.has(nombre)) continue;
            const costo = f.precio + CALIBRADO;
            altas.push({ nombre, pelado: f.precio, costo, precio: Math.ceil(costo * MARKUP_SOL) });
        }
        console.log(`1 · SOL NEUTROS a dar de alta: ${altas.length}`);
        altas.forEach(a => console.log(`     ${a.nombre.slice(0, 54).padEnd(56)}costo ${$(a.costo).padStart(10)} → ${$(a.precio)}`));

        // ── 2. TALLADO / DIGITAL en el nombre ────────────────────────────────
        const renombres = [];
        for (const x of ps) {
            const n = x.name.trim();
            let nuevo = null;
            if (n.startsWith('Monofocal laboratorio - ')) nuevo = n.replace('Monofocal laboratorio - ', 'Monofocal TALLADO (CNC) - ');
            else if (n.startsWith('Monofocal digital - ')) nuevo = n.replace('Monofocal digital - ', 'Monofocal DIGITAL (free-form) - ');
            if (nuevo && nuevo !== n) renombres.push({ id: x.id, de: n, a: nuevo });
        }
        console.log(`\n2 · NOMBRES a aclarar TALLADO/DIGITAL: ${renombres.length}`);
        renombres.slice(0, 4).forEach(r => console.log(`     "${r.de.slice(0, 46)}"\n      → "${r.a.slice(0, 60)}"`));
        if (renombres.length > 4) console.log(`     … y ${renombres.length - 4} más`);
        const choque = renombres.filter(r => yaEstan.has(r.a));
        if (choque.length) { console.error(`\n❌ ${choque.length} renombres chocarían con un nombre existente. No se escribe nada.`); process.exitCode = 1; return; }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const id = randomUUID();
            await prisma.$executeRaw`
                insert into "Product" (id, name, category, laboratory, type, brand, model, "lensIndex", "unitType",
                    origin, price, cost, "baseCost", is2x1, "imagenesCatalogo", "publishToWeb", "createdAt", "updatedAt")
                values (${id}, ${a.nombre}, 'Cristal', 'GRUPO OPTICO', 'Cristal Monofocal', 'Smart', ${a.nombre},
                    ${null}, 'PAR', 'STOCK', ${a.precio}, ${a.costo}, ${a.pelado}, false, '{}', false, now(), now())`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${id},
                    ${JSON.stringify({ producto: a.nombre, seccion: 'Sol neutros', pelado: a.pelado, calibrado: CALIBRADO,
                        costo: a.costo, markup: MARKUP_SOL, precio: a.precio,
                        nota: 'Lente de sol sin graduación: la lista los describe por base y diámetro.' })}::jsonb, now())`;
        }
        console.log(`\n✅ ${altas.length} sol neutros dados de alta.`);

        for (const r of renombres) {
            await prisma.$executeRaw`update "Product" set name = ${r.a}, model = ${r.a}, "updatedAt" = now() where id = ${r.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${r.id},
                    ${JSON.stringify({ nombreDe: r.de, nombreA: r.a,
                        motivo: 'La lista aclara CNC = tallada convencional y ULTRA = digital free-form; ahora lo dice el nombre.' })}::jsonb, now())`;
        }
        console.log(`✅ ${renombres.length} nombres con TALLADO/DIGITAL explícito.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
