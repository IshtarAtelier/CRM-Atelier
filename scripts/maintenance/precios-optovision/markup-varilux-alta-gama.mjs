/**
 * Lleva a ×2,85 las tres líneas de ALTA GAMA de Varilux: Physio, Physio 3.0 y
 * XR Design.
 *
 * Decisión de Ishtar (8/9/2026). Dos cosas la motivaron:
 *
 * 1. El Varilux estaba en ×2,50 y el Kodak en ×2,85 — la marca premium tenía
 *    MENOS markup que la de abajo. Emparejarlas deja la escalera coherente: el
 *    Varilux sigue arriba, pero por su costo, no por el multiplicador.
 * 2. El Smart AI Lens de Grupo Óptico había quedado por encima del XR Design
 *    ($3.028.468 contra $2.757.363), y encima sin 2x1 mientras el XR lo lleva.
 *    Con el XR en ×2,85 llega a $3.143.394 y vuelve a ser el tope del catálogo,
 *    que es donde corresponde.
 *
 * NO se tocan Comfort, Comfort Max, Liberty ni Digitime: Ishtar eligió estas
 * tres nada más. Tampoco las promos "Mi Primer Varilux", que son el mismo
 * cristal con 50% off y se manejan aparte.
 *
 * QUÉ TOCA: `price`. Nunca el costo.
 *
 *   node scripts/maintenance/precios-optovision/markup-varilux-alta-gama.mjs
 *   node scripts/maintenance/precios-optovision/markup-varilux-alta-gama.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { pathToFileURL } from 'node:url';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const MARKUP = 2.85;
const FIRMA = 'Ishtar (Varilux alta gama a ×2,85)';

/** Las tres líneas alcanzadas, en el orden en que las nombró Ishtar. */
const LINEAS = [
    ['Varilux Physio 3.0', /physio\s*3/i],
    ['Varilux Physio', /physio/i],
    ['Varilux XR Design', /xr\s*design/i],
];

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
        console.log(`Physio, Physio 3.0 y XR Design → ×${MARKUP} · las promos Mi Primer NO se tocan\n`);

        const todos = await prisma.$queryRaw`
            select id, name, price, cost from "Product"
            where category = 'Cristal' and laboratory = 'OPTOVISION'
              and name ~* 'varilux' and name !~* 'mi primer'`;

        // Physio 3.0 va PRIMERO: si "physio" ganara antes, se llevaría los 3.0
        // adentro y quedarían contados en la línea equivocada.
        const vistos = new Set();
        const cambian = [];
        for (const [nom, re] of LINEAS) {
            for (const x of todos) {
                if (vistos.has(x.id) || !re.test(x.name) || !(x.cost > 0)) continue;
                vistos.add(x.id);
                const nuevo = Math.ceil(x.cost * MARKUP);
                if (nuevo !== Math.round(x.price)) cambian.push({ ...x, linea: nom, nuevo, hoy: Math.round(x.price) });
            }
        }

        for (const [nom] of LINEAS) {
            const g = cambian.filter(c => c.linea === nom);
            if (!g.length) { console.log(`  ${nom.padEnd(20)} sin cambios`); continue; }
            const h = g.map(c => c.hoy).sort((a, b) => a - b);
            const v = g.map(c => c.nuevo).sort((a, b) => a - b);
            console.log(`  ${nom.padEnd(20)}${String(g.length).padStart(3)} cristales · ${$(h[0])} – ${$(h[h.length - 1])} → ${$(v[0])} – ${$(v[v.length - 1])}`);
        }
        console.log(`\n  ${cambian.length} precios · aumento total ${$(cambian.reduce((a, c) => a + c.nuevo - c.hoy, 0))}`);

        // Que el Varilux siga siendo el tope del catálogo es el punto del cambio.
        const [{ otro }] = await prisma.$queryRaw`
            select max(price)::int otro from "Product"
            where category = 'Cristal' and type = 'Cristal Multifocal'
              and name !~* 'mi primer' and name !~* 'varilux'`;
        const techo = Math.max(...cambian.map(c => c.nuevo));
        console.log(`\n  techo del Varilux ${$(techo)} vs el multifocal más caro de otra marca ${$(otro)} → ${techo > otro ? '✅ el Varilux queda arriba' : '⚠️  todavía lo pasan'}`);

        if (!APLICAR) { console.log('\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar'); return; }

        for (const c of cambian) {
            await prisma.$executeRaw`update "Product" set price = ${c.nuevo}, "updatedAt" = now() where id = ${c.id}`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'UPDATE', 'PRODUCT', ${c.id},
                    ${JSON.stringify({ producto: String(c.name).trim(), linea: c.linea, precioDe: c.hoy, precioA: c.nuevo,
                        markupDe: +(c.price / c.cost).toFixed(2), markupA: MARKUP })}::jsonb, now())`;
        }
        console.log(`\n✅ ${cambian.length} precio(s) a ×${MARKUP}. Los costos no se tocaron.`);
    } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(err => { console.error(err); process.exitCode = 1; });
}
