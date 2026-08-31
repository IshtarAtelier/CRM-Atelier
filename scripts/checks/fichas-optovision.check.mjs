// ────────────────────────────────────────────────────────────────────────────
// FICHAS COMPLETAS de los cristales de OPTOVISIÓN.
//
// Un cristal con la ficha a medias no se puede cotizar bien: sin rango de
// esfera/cilindro/adición el vendedor no sabe si la receta entra, sin índice
// no sabe qué material es, y sin "confección" no sabe si sale de un blank de
// stock o hay que mandarlo a fabricar (que son días de diferencia para el
// cliente). Este check dice, producto por producto, qué le falta.
//
// Campos que se exigen a TODO cristal:
//   name, type, brand, lensIndex, unitType, laboratory, origin (confección),
//   price, cost, baseCost
// Campos de RANGO (esfera / cilindro / adición): se exigen según el tipo —
//   un monofocal no lleva adición, y eso no es un dato faltante.
//
// SOLO LEE. Correr:
//   node scripts/checks/fichas-optovision.check.mjs              (base LOCAL)
//   node scripts/checks/fichas-optovision.check.mjs --produccion
//   node scripts/checks/fichas-optovision.check.mjs --detalle    (lista todos)
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const PRODUCCION = process.argv.includes('--produccion');
const DETALLE = process.argv.includes('--detalle');
const LAB = 'OPTOVISION';

const url = PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${PRODUCCION ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en el .env`); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url } } });

/** ¿Este cristal lleva adición? Solo los que gradúan de cerca. */
const llevaAdicion = p => /multifocal|bifocal|progresiv|ocupacional/i.test(`${p.type || ''} ${p.name || ''}`);

/** Qué le falta a un producto, en castellano y ordenado por importancia. */
function faltantesDe(p) {
    const falta = [];
    if (!p.name?.trim()) falta.push('nombre');
    if (!p.type?.trim()) falta.push('tipo');
    if (!p.brand?.trim()) falta.push('marca');
    if (!p.model?.trim()) falta.push('modelo');
    if (!p.lensIndex?.trim()) falta.push('índice');
    if (!p.origin?.trim()) falta.push('confección (stock/lab)');
    if (!p.unitType?.trim()) falta.push('unidad');
    if (!(p.price > 0)) falta.push('precio');
    if (!(p.cost > 0)) falta.push('costo');
    if (p.baseCost == null) falta.push('costo pelado');
    if (p.sphereMin == null || p.sphereMax == null) falta.push('rango esfera');
    if (p.cylinderMin == null || p.cylinderMax == null) falta.push('rango cilindro');
    if (llevaAdicion(p) && (p.additionMin == null || p.additionMax == null)) falta.push('rango adición');
    return falta;
}

const productos = await prisma.$queryRaw`
    select id, name, type, brand, model, "lensIndex", "unitType", laboratory, origin,
        price, cost, "baseCost", "sphereMin", "sphereMax", "cylinderMin", "cylinderMax",
        "additionMin", "additionMax", is2x1
    from "Product"
    where category = 'Cristal' and laboratory = ${LAB}
    order by name`;

console.log(`\nBase: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'LOCAL'} · ${productos.length} cristales de ${LAB}\n`);

const conFalta = productos.map(p => ({ p, falta: faltantesDe(p) })).filter(x => x.falta.length);
const completos = productos.length - conFalta.length;

// ── Resumen por campo: qué falta y en cuántos ───────────────────────────────
const porCampo = new Map();
for (const { falta } of conFalta) for (const f of falta) porCampo.set(f, (porCampo.get(f) || 0) + 1);

console.log(`  ✅ completos: ${completos}     ❌ con algo faltante: ${conFalta.length}\n`);
if (porCampo.size) {
    console.log('  Qué falta y en cuántos productos:');
    for (const [campo, n] of [...porCampo.entries()].sort((a, b) => b[1] - a[1])) {
        const pct = Math.round(n / productos.length * 100);
        console.log(`    ${String(n).padStart(4)}  (${String(pct).padStart(2)}%)  ${campo}`);
    }
}

// ── Los más incompletos primero, para saber por dónde empezar ───────────────
if (conFalta.length) {
    const orden = [...conFalta].sort((a, b) => b.falta.length - a.falta.length);
    const mostrar = DETALLE ? orden : orden.slice(0, 20);
    console.log(`\n  ${DETALLE ? 'Todos' : `Los ${mostrar.length} más incompletos`} (de peor a mejor):\n`);
    for (const { p, falta } of mostrar) {
        console.log(`    [${String(falta.length).padStart(2)}] ${String(p.name).slice(0, 56).padEnd(58)}${falta.join(', ')}`);
    }
    if (!DETALLE && orden.length > mostrar.length) {
        console.log(`\n    …y ${orden.length - mostrar.length} más. Para verlos todos: --detalle`);
    }
}

await prisma.$disconnect();

console.log(conFalta.length === 0
    ? `\n✅ Los ${productos.length} cristales de ${LAB} tienen la ficha completa.\n`
    : `\n❌ ${conFalta.length} de ${productos.length} cristales de ${LAB} tienen datos faltantes.\n`);
process.exit(conFalta.length === 0 ? 0 : 1);
