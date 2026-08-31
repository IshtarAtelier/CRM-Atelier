/**
 * FIJA EL MARKUP de una familia entera: precio = costo × markup objetivo.
 *
 * Distinto de piso-de-margen.mjs, que solo EMPUJA HACIA ARRIBA a los que están
 * por debajo. Este pone a todos en el número exacto, suba o baje. Es la
 * herramienta para acomodar la escalera entre marcas (Sygnus < Kodak < Varilux),
 * que no se puede armar solo con un piso.
 *
 * POR QUÉ SEPARADO: el piso es una regla de seguridad —ningún cristal por debajo
 * de ×2,5— y se corre siempre. Esto es una decisión comercial por familia y se
 * corre cuando se decide mover una marca. Mezclarlos haría que una corrida de
 * rutina cambie precios que nadie pidió mover.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-optovision/markup-por-familia.mjs
 *   node scripts/maintenance/precios-optovision/markup-por-familia.mjs --aplicar
 *   node scripts/maintenance/precios-optovision/markup-por-familia.mjs --produccion --aplicar
 *   ... --solo varilux        (corre una sola familia de la tabla)
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const iSolo = process.argv.indexOf('--solo');
const SOLO = iSolo !== -1 ? process.argv[iSolo + 1] : null;
/**
 * NUNCA BAJAR (Ishtar, 31/8/2026): "si alguno con los costos reales estaba por
 * más de 2.5, genial, dejalo; si estaba por debajo, nivelalo".
 * O sea: el markup objetivo es un PISO por familia, no un precio exacto. Un
 * producto que ya rinde más se deja tranquilo — bajarle el precio sería resignar
 * margen que ya estaba ganado. Con --bajar-tambien se permite el ajuste exacto,
 * que es lo que haría falta para armar una escalera entre marcas.
 */
const BAJAR = process.argv.includes('--bajar-tambien');
const FIRMA = 'Ishtar (markup objetivo por familia)';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }
if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
    console.error('❌ DATABASE_URL no apunta a localhost. Para tocar producción hace falta --produccion.');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const pesos = n => `$${Math.round(n).toLocaleString('es-AR')}`;

/**
 * LA ESCALERA. Cada familia con su markup objetivo, decidido por Ishtar.
 * Solo Optovisión: en Grupo Óptico los markups son otra cosa (lista más barata
 * y sin IVA, rinden ×4-5) y no se tocan desde acá.
 */
const FAMILIAS = [
    // EL ORDEN IMPORTA: gana el primero que matchea, así cada producto cae en
    // una sola familia. "MI PRIMER KODAK" tiene que resolverse como promo, no
    // como Kodak, o se le aplicaría el ×2,85.
    {
        clave: 'mi-primer', markup: 2.50,
        nota: 'La promo del 50% va al mismo piso que el resto (Ishtar, 31/8/2026).',
        test: n => /mi\s*primer/i.test(n),
    },
    {
        clave: 'kodak', markup: 2.85,
        nota: 'Más alto A PROPÓSITO: Kodak tiene que quedar por ENCIMA de Sygnus, y su costo es MENOR. '
            + 'Al mismo ×2,5 los dos, Kodak caía abajo (Stylis: Kodak $1.044.578 vs Sygnus $1.189.550). '
            + '×2,85 es el mínimo que lo deja arriba en los tres materiales.',
        test: n => /kodak/i.test(n),
    },
    {
        clave: 'sygnus', markup: 2.50,
        nota: 'Baja fuerte: venía a ×3,32, el markup más alto de Optovisión (Ishtar, 31/8/2026).',
        test: n => /new\s*editions?|sygnus/i.test(n),
    },
    {
        clave: 'varilux', markup: 2.50,
        nota: 'Ishtar 31/8/2026: "todo Varilux 2.5, sí o sí todos".',
        test: n => /comfort|physio|xr\s*design|xr\s*pro|liberty|digitime/i.test(n),
    },
    { clave: 'eyezen', markup: 2.50, test: n => /eyezen/i.test(n) },
    { clave: 'myopilux', markup: 2.50, test: n => /myopilux/i.test(n) },
];

/** La familia de un producto: gana la primera que matchea. */
const familiaDe = nombre => FAMILIAS.find(f => f.test(nombre)) ?? null;

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

    const productos = await prisma.$queryRaw`
        select id, name, price, cost from "Product"
        where category = 'Cristal' and laboratory = 'OPTOVISION' and cost > 0 and price > 0
        order by name`;

    let totalSube = 0, totalBaja = 0, tocados = 0;

    for (const fam of FAMILIAS) {
        if (SOLO && SOLO !== fam.clave) continue;
        const míos = productos.filter(p => familiaDe(p.name) === fam);
        const cambian = míos
            .map(p => ({ ...p, mk: p.price / p.cost, nuevo: Math.round(p.cost * fam.markup) }))
            .filter(p => p.nuevo !== Math.round(p.price))
            .filter(p => BAJAR || p.nuevo > p.price);   // por defecto solo sube

        console.log(`━━ ${fam.clave.toUpperCase()} → ×${fam.markup}  (${míos.length} productos, ${cambian.length} cambian)`);
        if (fam.nota) console.log(`   ${fam.nota}`);
        console.log('');

        const suben = cambian.filter(p => p.nuevo > p.price);
        const bajan = cambian.filter(p => p.nuevo < p.price);

        for (const grupo of [['SUBEN', suben], ['BAJAN', bajan]]) {
            if (!grupo[1].length) continue;
            console.log(`   ${grupo[0]} (${grupo[1].length}):`);
            for (const p of grupo[1].sort((a, b) => Math.abs(b.nuevo - b.price) - Math.abs(a.nuevo - a.price))) {
                const d = p.nuevo - p.price;
                const pct = (d / p.price * 100).toFixed(1);
                console.log(`     ×${p.mk.toFixed(2)}  ${String(p.name).slice(0, 46).padEnd(48)}` +
                    `${pesos(p.price).padStart(12)} → ${pesos(p.nuevo).padStart(12)}  (${d > 0 ? '+' : ''}${pesos(d)}, ${d > 0 ? '+' : ''}${pct}%)`);
            }
            console.log('');
        }
        totalSube += suben.reduce((a, p) => a + p.nuevo - p.price, 0);
        totalBaja += bajan.reduce((a, p) => a + p.price - p.nuevo, 0);
        tocados += cambian.length;

        if (APLICAR) {
            for (const p of cambian) {
                await prisma.$executeRaw`update "Product" set price = ${p.nuevo}, "updatedAt" = now() where id = ${p.id}`;
                await prisma.$executeRaw`
                    insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                    values (gen_random_uuid()::text, ${FIRMA}, 'PRICE_OVERRIDE', 'PRODUCT', ${p.id},
                        ${JSON.stringify({ familia: fam.clave, markupObjetivo: fam.markup, de: p.price, a: p.nuevo, markupPrevio: Number(p.mk.toFixed(3)), producto: p.name })}::jsonb, now())`;
            }
        }
    }

    console.log(`Resumen: ${tocados} precio(s) cambian · +${pesos(totalSube)} de aumentos · −${pesos(totalBaja)} de bajas`);
    console.log(APLICAR ? '\n✅ Aplicado. Los costos no se tocaron.' : '\nEnsayo: no se escribió nada. Para aplicarlo: --aplicar');
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
