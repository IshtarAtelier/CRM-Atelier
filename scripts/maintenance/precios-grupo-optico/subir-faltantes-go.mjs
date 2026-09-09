/**
 * SUBE los 5 renglones de la lista de Grupo Óptico que nunca se habían cargado.
 *
 * Ishtar, 9/9/2026: "auditá TODO, que no quede ningún dato sin subir".
 * Los encontró el cruce de la lista de agosto contra la base: de las nueve
 * secciones de Grupo Óptico, ocho estaban completas y faltaban estos cinco.
 *
 * QUÉ SON:
 *  · Los 4 CONTROL DE MIOPÍA MAJESTIC (pág. 5). Es la tercera línea de control
 *    de miopía —sistema DOMS— junto a MyoFix y MyoLens, que sí estaban. Ojo con
 *    los rangos: la versión DIGITAL llega mucho más lejos (-16 en 1,49 y -20 en
 *    1,60) que la común (-10 en las dos).
 *  · El KRIPTOCK bifocal orgánico blanco (pág. 6), a $22.339.
 *
 * 🔴 EL PELIGRO DEL KRIPTOCK: su gemelo, el Flat Top orgánico blanco de la misma
 * página, vale $22.340 — UN PESO más. Son dos renglones distintos con dos
 * precios distintos, no una errata. Y como todo el sistema empareja producto con
 * renglón por el precio pelado, cargarlo con el número equivocado lo haría pisar
 * al Flat Top en la próxima sincronización de costos. Por eso el script verifica
 * que el $22.340 ya exista y sea otro producto antes de escribir.
 *
 * MARKUPS, que son decisiones y no cuentas:
 *  · Majestic ×3,39, el mismo que MyoLens. La familia de control de miopía usa
 *    ×3,39 (MyoLens) y ×3,73 (MyoFix); el Majestic entra con el más bajo de los
 *    dos. La escalera por costo la da la lista, no nosotros: MyoLens $65.026 <
 *    Majestic $76.754 < Majestic DIGITAL $99.780 < MyoFix $132.484.
 *  · Kriptock bifocal: el markup EXACTO de su gemelo Flat Top orgánico blanco,
 *    para que dos cristales que al laboratorio le salen lo mismo no salgan a la
 *    venta a precios distintos.
 *
 * Por defecto va contra la base LOCAL y NO escribe.
 *   node scripts/maintenance/precios-grupo-optico/subir-faltantes-go.mjs --produccion
 *   node scripts/maintenance/precios-grupo-optico/subir-faltantes-go.mjs --produccion --aplicar
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
const CALIBRADO_GO = 7272;
const FIRMA = 'Ishtar (faltantes de la lista de Grupo Óptico)';

const NUEVOS = [
    {
        nombre: 'Control miopía Majestic · Orgánico Blanco 1.49', indice: '1.49', pelado: 76754,
        markup: 3.39, tipo: 'Cristal Monofocal', esf: [-10, -0.25], cil: [-6, 6],
        modelo: 'Control de miopía, sistema DOMS · tallado CNC',
    },
    {
        nombre: 'Control miopía Majestic DIGITAL · Orgánico Blanco 1.49', indice: '1.49', pelado: 99780,
        markup: 3.39, tipo: 'Cristal Monofocal', esf: [-16, -0.25], cil: [-6, 6],
        modelo: 'Control de miopía DIGITAL, sistema DOMS · admite multifacetado sin cargo',
    },
    {
        nombre: 'Control miopía Majestic · Orgánico Blanco Alto Índice 1.60', indice: '1.60', pelado: 118202,
        markup: 3.39, tipo: 'Cristal Monofocal', esf: [-10, -0.25], cil: [-6, 6],
        modelo: 'Control de miopía, sistema DOMS · tallado CNC',
    },
    {
        nombre: 'Control miopía Majestic DIGITAL · Orgánico Blanco Alto Índice 1.60', indice: '1.60', pelado: 153662,
        markup: 3.39, tipo: 'Cristal Monofocal', esf: [-20, -0.25], cil: [-6, 6],
        modelo: 'Control de miopía DIGITAL, sistema DOMS · admite multifacetado sin cargo',
    },
    {
        nombre: 'Bifocal Kriptock · Orgánico Blanco 1.49', indice: '1.49', pelado: 22339,
        gemelo: 22340, tipo: 'Cristal Bifocal', esf: [-4, 5.5], cil: [-4, 4], add: [1, 3.5],
        modelo: 'Bifocal Kriptock tallado CNC',
    },
];

const pesos = n => `$${Math.round(Number(n)).toLocaleString('es-AR')}`;

async function main() {
    const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) { console.error('Falta la URL de la base en el .env'); process.exitCode = 1; return; }
    if (!PRODUCCION && !/localhost|127\.0\.0\.1/.test(url)) {
        console.error('DATABASE_URL no apunta a localhost. Para tocar produccion hace falta --produccion.');
        process.exitCode = 1; return;
    }
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
        console.log(`Base: ${PRODUCCION ? 'PRODUCCION' : 'LOCAL'} | modo: ${APLICAR ? 'APLICAR (escribe)' : 'ENSAYO (no escribe)'}\n`);

        const ya = await prisma.$queryRaw`
            select id, name, "baseCost", cost, price from "Product"
            where category = 'Cristal' and laboratory = 'GRUPO OPTICO' and "baseCost" is not null`;
        const porPelado = p => ya.filter(x => Math.round(Number(x.baseCost)) === p);

        const altas = [], omitidos = [];
        for (const n of NUEVOS) {
            if (porPelado(n.pelado).length) { omitidos.push({ ...n, motivo: 'ya existe un producto con ese pelado' }); continue; }
            const costo = n.pelado + CALIBRADO_GO;
            let markup = n.markup;
            if (n.gemelo != null) {
                const g = porPelado(n.gemelo)[0];
                if (!g) { omitidos.push({ ...n, motivo: `no encuentro el gemelo de ${pesos(n.gemelo)} para copiarle el markup` }); continue; }
                markup = Number(g.price) / Number(g.cost);
                console.log(`  Kriptock: le copio el markup a "${g.name}" -> x${markup.toFixed(2)}\n`);
            }
            altas.push({ ...n, costo, markup, precio: Math.round(costo * markup) });
        }

        console.log(`  ${'Cristal'.padEnd(56)}${'pelado'.padStart(11)}${'costo'.padStart(11)}${'markup'.padStart(9)}${'precio'.padStart(12)}   rango`);
        for (const a of altas) {
            console.log(`  ${a.nombre.slice(0, 54).padEnd(56)}${pesos(a.pelado).padStart(11)}${pesos(a.costo).padStart(11)}` +
                `${('x' + a.markup.toFixed(2)).padStart(9)}${pesos(a.precio).padStart(12)}   esf ${a.esf[0]}/${a.esf[1]} cil ${a.cil[0]}/${a.cil[1]}`);
        }
        if (omitidos.length) {
            console.log('\n  NO se cargan:');
            omitidos.forEach(o => console.log(`    ${o.nombre} — ${o.motivo}`));
        }

        if (!APLICAR) { console.log('\nEnsayo: no se escribio nada. Para aplicarlo: --aplicar'); return; }

        for (const a of altas) {
            const r = await prisma.$queryRaw`
                insert into "Product" (id, name, category, type, brand, model, stock, "unitType",
                    laboratory, price, cost, "baseCost", "lensIndex", origin,
                    "sphereMin", "sphereMax", "cylinderMin", "cylinderMax", "additionMin", "additionMax",
                    "publishToWeb", "publishToWholesale", "wholesalePrice", "ageGroup", "customSlug",
                    gender, mpn, "seoDescription", "seoTags", "seoTitle", "imageProcessingStatus",
                    "createdAt", "updatedAt")
                values (gen_random_uuid()::text, ${a.nombre}, 'Cristal', ${a.tipo}, 'Smart', ${a.modelo},
                    0, 'UNIDAD', 'GRUPO OPTICO', ${a.precio}, ${a.costo}, ${a.pelado}, ${a.indice}, 'LABORATORIO',
                    ${a.esf[0]}, ${a.esf[1]}, ${a.cil[0]}, ${a.cil[1]}, ${a.add?.[0] ?? null}, ${a.add?.[1] ?? null},
                    false, false, 0, '', '', '', '', '', '', '', 'IDLE', now(), now())
                returning id`;
            await prisma.$executeRaw`
                insert into "AuditLog" (id, "userName", action, "entityType", "entityId", details, "createdAt")
                values (gen_random_uuid()::text, ${FIRMA}, 'CREATE', 'PRODUCT', ${r[0].id},
                    ${JSON.stringify({ producto: a.nombre, pelado: a.pelado, costo: a.costo,
                        precio: a.precio, markup: Number(a.markup.toFixed(2)), calibrado: CALIBRADO_GO })}::jsonb, now())`;
        }
        console.log(`\nLISTO: ${altas.length} cristal(es) cargados.`);
    } finally { await prisma.$disconnect(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
