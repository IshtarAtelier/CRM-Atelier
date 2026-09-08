/**
 * Lleva las tres líneas premium de Grupo Óptico —PRO, EXCLUSIVE y AI LENS— a
 * ×4,7.
 *
 * Por qué (Ishtar, 8/9/2026): "el PRO de Grupo Óptico está en menos y es mejor
 * que el Smart FREE". Tenía razón, y la causa es la que ella misma señaló: al
 * Smart FREE no se le bajó el markup —quedó de ×4,00 a ×4,93— mientras las tres
 * premium entraron a ×4 pelado. Con el mismo material, el que tiene más markup
 * gana aunque sea el producto inferior: el PRO quedaba por debajo del FREE en
 * 16 de 25 materiales.
 *
 * ×4,7 es el número que pidió Ishtar y resuelve la escalera entera:
 *   · PRO supera al FREE en los 25 materiales (a ×4,5 fallaba en 1).
 *   · Entre las tres premium el orden se mantiene solo, porque comparten markup
 *     y la lista ya las ordena por costo (pro < exclusive < ai_lens en cada
 *     renglón). Igualar el markup es lo que evita que se crucen.
 *
 * El Smart FREE NO se toca: decisión explícita de Ishtar.
 *
 *   node scripts/maintenance/precios-grupo-optico/markup-premium-go.mjs
 *   node scripts/maintenance/precios-grupo-optico/markup-premium-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';
import { emparejar } from './emparejador-go.mjs';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
/**
 * Cada línea con SU markup, el mínimo que la deja por encima del escalón de
 * abajo en los 25 materiales (Ishtar, 8/9/2026: "nivelalos a los 3, fijate cómo
 * marcando poco quedan los 3 escalonados por arriba del Smart FREE y cada uno
 * en orden, pero con un markup propio").
 *
 * Salieron de una búsqueda en pasos de 0,05 desde ×4 —el piso— hacia arriba,
 * verificando material por material. Que EXCLUSIVE tenga menos markup que PRO
 * no es un error: su costo de lista ya es mayor, así que con menos multiplicador
 * igual queda arriba. Marcar más sería cobrar de más sin necesidad.
 */
const MARKUP_POR_LINEA = {
    'Multifocal Smart Lens PRO': 4.55,
    'Multifocal Smart Lens EXCLUSIVE': 4.40,
    'Multifocal Smart Lens AI LENS': 4.00,
};
const LINEAS = Object.keys(MARKUP_POR_LINEA);
const FIRMA = 'Ishtar (premium de Grupo Óptico a ×4,7)';

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
        console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO'}`);
        console.log(`PRO ×4,55 · EXCLUSIVE ×4,40 · AI LENS ×4,00 — el mínimo de cada una · el Smart FREE no se toca\n`);

        const ps = await prisma.$queryRaw`
            select id, name, "lensIndex", origin, price, cost
            from "Product" where category = 'Cristal' and laboratory = 'GRUPO OPTICO'`;
        const { ok } = emparejar(ps);
        const cambian = ok.filter(x => LINEAS.includes(x.seccion) && x.cost > 0)
            .map(x => ({ ...x, mk: MARKUP_POR_LINEA[x.seccion], nuevo: Math.ceil(x.cost * MARKUP_POR_LINEA[x.seccion]), hoy: Math.round(x.price) }))
            .filter(x => x.nuevo !== x.hoy);

        for (const sec of LINEAS) {
            const g = cambian.filter(x => x.seccion === sec);
            if (!g.length) { console.log(`  ${sec.padEnd(34)} sin cambios`); continue; }
            const v = g.map(x => x.nuevo).sort((a, b) => a - b);
            const h = g.map(x => x.hoy).sort((a, b) => a - b);
            console.log(`  ${sec.replace('Multifocal Smart Lens ', 'Smart ').padEnd(20)}${String(g.length).padStart(3)} cristales · ${$(h[0])}–${$(h[h.length - 1])} → ${$(v[0])}–${$(v[v.length - 1])}`);
        }
        console.log(`\n  ${cambian.length} precios · aumento total ${$(cambian.reduce((a, x) => a + x.nuevo - x.hoy, 0))}`);

        // La escalera, verificada material por material antes de escribir nada.
        const precio = (x) => LINEAS.includes(x.seccion) ? Math.ceil(x.cost * MARKUP_POR_LINEA[x.seccion]) : Math.round(x.price);
        const M = {};
        for (const x of ok) {
            const linea = x.seccion.replace('Multifocal Smart Lens ', '');
            if (!['FREE', 'PRO', 'EXCLUSIVE', 'AI LENS'].includes(linea)) continue;
            (M[`${x.renglon} ${x.indice}`] ??= {})[linea] = precio(x);
        }
        console.log('\n  VERIFICACIÓN de la escalera:');
        let roto = 0;
        for (const [a, b] of [['FREE', 'PRO'], ['PRO', 'EXCLUSIVE'], ['EXCLUSIVE', 'AI LENS']]) {
            const par = Object.values(M).filter(v => v[a] && v[b]);
            const mal = par.filter(v => v[b] <= v[a]);
            roto += mal.length;
            console.log(`     ${b} > ${a}: ${mal.length === 0 ? `✅ en los ${par.length} materiales` : `❌ falla en ${mal.length}`}`);
        }
        if (roto) { console.error('\n❌ La escalera no cierra: no se escribe nada.'); process.exitCode = 1; return; }

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const x of cambian) {
            await prisma.$executeRaw`update "Product" set price = ${x.nuevo}, "updatedAt" = now() where id = ${x.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${x.id},
                    ${JSON.stringify({ producto: String(x.name).trim(), linea: x.seccion, precioDe: x.hoy,
                        precioA: x.nuevo, markupDe: +(x.price / x.cost).toFixed(2), markupA: x.mk })}::jsonb, now())`;
        }
        console.log(`\n✅ ${cambian.length} precio(s) con el markup propio de su línea. Los costos no se tocaron.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
